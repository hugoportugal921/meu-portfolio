using System.Text;
using System.Text.Json;
using FinFlow.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace FinFlow.Infrastructure;

public sealed record ServiceIdentity(string Name);
public sealed class BrokerState
{
    public volatile bool PublisherReady;
    public volatile bool ConsumerReady;
}
public static class Broker
{
    public static Task<IConnection> Connect(IConfiguration config, CancellationToken ct) =>
        new ConnectionFactory
        {
            Uri = new Uri(config["RabbitMQ:Uri"] ?? throw new InvalidOperationException("RabbitMQ__Uri is required.")),
            AutomaticRecoveryEnabled = true,
            NetworkRecoveryInterval = TimeSpan.FromSeconds(5),
            ClientProvidedName = "FinFlow"
        }.CreateConnectionAsync(ct);

    public static async Task Topology(IChannel channel, CancellationToken ct)
    {
        await channel.ExchangeDeclareAsync("finflow.events",ExchangeType.Direct,true,false,cancellationToken:ct);
        await channel.ExchangeDeclareAsync("finflow.dead",ExchangeType.Direct,true,false,cancellationToken:ct);
        foreach (var (queue,route) in new[]{("ledger.requests",Routes.Requested),("transactions.results",Routes.Result)})
        {
            await channel.QueueDeclareAsync(queue+".dead",true,false,false,cancellationToken:ct);
            await channel.QueueBindAsync(queue+".dead","finflow.dead",queue,cancellationToken:ct);
            await channel.QueueDeclareAsync(queue,true,false,false,new Dictionary<string,object?>
            {
                ["x-queue-type"]="quorum",["x-delivery-limit"]=5,
                ["x-dead-letter-exchange"]="finflow.dead",["x-dead-letter-routing-key"]=queue,
                ["x-dead-letter-strategy"]="at-least-once",["x-overflow"]="reject-publish"
            },cancellationToken:ct);
            await channel.QueueBindAsync(queue,"finflow.events",route,cancellationToken:ct);
        }
    }
}

public sealed class OutboxPublisher(Database database, IConfiguration config, BrokerState state, ILogger<OutboxPublisher> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var connection = await Broker.Connect(config,stoppingToken);
                await using var channel = await connection.CreateChannelAsync(new CreateChannelOptions(
                    publisherConfirmationsEnabled:true,publisherConfirmationTrackingEnabled:true),stoppingToken);
                await Broker.Topology(channel,stoppingToken);
                while (!stoppingToken.IsCancellationRequested && channel.IsOpen)
                {
                    state.PublisherReady=connection.IsOpen;
                    foreach (var message in await Outbox.Pending(database,stoppingToken))
                    {
                        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                        timeout.CancelAfter(TimeSpan.FromSeconds(10));
                        await channel.BasicPublishAsync("finflow.events",message.RoutingKey,true,
                            new BasicProperties { Persistent=true,ContentType="application/json",MessageId=message.MessageId.ToString() },
                            Encoding.UTF8.GetBytes(message.Payload),timeout.Token);
                        // Only mark after the broker confirms. A crash here causes a safe redelivery.
                        await Outbox.MarkPublished(database,message.MessageId,stoppingToken);
                    }
                    await Task.Delay(250,stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception e)
            {
                state.PublisherReady=false;
                logger.LogWarning("Outbox retry: {ErrorType}",e.GetType().Name);
                await Task.Delay(3000,stoppingToken);
            }
            finally { state.PublisherReady=false; }
        }
    }
}

public sealed class MessageConsumer(IServiceScopeFactory scopes, IConfiguration config, ServiceIdentity identity,
    BrokerState state, ILogger<MessageConsumer> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var connection = await Broker.Connect(config,stoppingToken);
                await using var channel = await connection.CreateChannelAsync(cancellationToken:stoppingToken);
                await Broker.Topology(channel,stoppingToken);
                await channel.BasicQosAsync(0,16,false,stoppingToken);
                var consumer = new AsyncEventingBasicConsumer(channel);
                consumer.ReceivedAsync += async (_,delivery) =>
                {
                    try
                    {
                        using var scope = scopes.CreateScope();
                        // Deserialize inside callback: RabbitMQ owns this memory until the callback returns.
                        if (identity.Name == "ledger")
                            await scope.ServiceProvider.GetRequiredService<ILedgerStore>().Apply(
                                JsonSerializer.Deserialize<TransferRequested>(delivery.Body.Span,Outbox.Json) ?? throw new JsonException(),stoppingToken);
                        else
                            await scope.ServiceProvider.GetRequiredService<ITransactionsStore>().Apply(
                                JsonSerializer.Deserialize<TransferResult>(delivery.Body.Span,Outbox.Json) ?? throw new JsonException(),stoppingToken);
                        await channel.BasicAckAsync(delivery.DeliveryTag,false,stoppingToken);
                    }
                    catch (Exception e) when (e is JsonException or ArgumentException)
                    {
                        logger.LogWarning("Invalid message sent to dead-letter queue: {MessageId}",delivery.BasicProperties.MessageId);
                        await channel.BasicNackAsync(delivery.DeliveryTag,false,false,stoppingToken);
                    }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
                    catch (Exception e)
                    {
                        logger.LogWarning("Consumer retry: {ErrorType}, message {MessageId}",e.GetType().Name,delivery.BasicProperties.MessageId);
                        await Task.Delay(1000,stoppingToken);
                        await channel.BasicNackAsync(delivery.DeliveryTag,false,true,stoppingToken);
                    }
                };
                await channel.BasicConsumeAsync(identity.Name=="ledger"?"ledger.requests":"transactions.results",false,consumer,stoppingToken);
                while (!stoppingToken.IsCancellationRequested && channel.IsOpen)
                {
                    state.ConsumerReady=connection.IsOpen;
                    await Task.Delay(1000,stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception e)
            {
                state.ConsumerReady=false;
                logger.LogWarning("Consumer reconnect: {ErrorType}",e.GetType().Name);
                await Task.Delay(3000,stoppingToken);
            }
            finally { state.ConsumerReady=false; }
        }
    }
}
