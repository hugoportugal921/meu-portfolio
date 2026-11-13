using System.Threading.RateLimiting;
using FinFlow.Core;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.OpenApi.Models;

namespace FinFlow.Infrastructure;

public static class Platform
{
    public static void AddPlatform(this WebApplicationBuilder builder, string service)
    {
        builder.Services.AddSingleton(new ServiceIdentity(service));
        builder.Services.AddSingleton<Database>();
        builder.Services.AddSingleton<BrokerState>();
        builder.Services.AddScoped<ITransactionsStore,TransactionsStore>();
        builder.Services.AddScoped<ILedgerStore,LedgerStore>();
        builder.Services.AddFinFlowAuth(builder.Configuration,builder.Environment);
        builder.Services.AddHostedService<OutboxPublisher>();
        builder.Services.AddHostedService<MessageConsumer>();
        builder.Services.AddProblemDetails();
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1",new(){Title=$"FinFlow {service}",Version="v1"});
            options.AddSecurityDefinition("Bearer",new(){Type=SecuritySchemeType.Http,Scheme="bearer",BearerFormat="JWT"});
            options.AddSecurityRequirement(new(){{new(){Reference=new(){Type=ReferenceType.SecurityScheme,Id="Bearer"}},Array.Empty<string>()}});
        });
        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode=429;
            options.AddPolicy("transfers",context=>RateLimitPartition.GetFixedWindowLimiter(
                context.User.FindFirst("sub")?.Value ?? "anonymous",_=>new(){PermitLimit=60,Window=TimeSpan.FromMinutes(1),QueueLimit=0}));
        });
    }
    public static void MapPlatform(this WebApplication app)
    {
        app.UseExceptionHandler();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseRateLimiter();
        // Swagger is a local development tool; production keeps the specification in the source package.
        if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
        app.MapGet("/health/live",()=>Results.Ok(new{status="alive"})).AllowAnonymous();
        app.MapGet("/health/ready",async (Database db,BrokerState broker,CancellationToken ct)=>
        {
            try
            {
                await using var c=await db.Open(ct);
                await using var cmd=Sql.Command(c,null,"SELECT 1");
                await cmd.ExecuteScalarAsync(ct);
                return broker.PublisherReady && broker.ConsumerReady ? Results.Ok(new{status="ready"}) : Results.StatusCode(503);
            }
            catch { return Results.StatusCode(503); }
        }).AllowAnonymous();
        if (app.Environment.IsDevelopment() && app.Configuration["Auth:Mode"]=="Development")
            app.MapPost("/dev/token",()=>Results.Ok(new{accessToken=Security.DemoToken(app.Configuration["Auth:SigningKey"]!),expiresIn=3600})).AllowAnonymous();
    }
}
