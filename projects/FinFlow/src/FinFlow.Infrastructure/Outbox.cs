using System.Text.Json;
using FinFlow.Core;
using Microsoft.Data.SqlClient;

namespace FinFlow.Infrastructure;

public static class Outbox
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static Task Add<T>(SqlConnection c, SqlTransaction tx, Guid id, string route, T body, CancellationToken ct) =>
        Sql.Execute(c,tx,"INSERT dbo.Outbox(MessageId,RoutingKey,Payload) VALUES(@id,@route,@payload)",ct,
            ("@id",id),("@route",route),("@payload",JsonSerializer.Serialize(body,Json)));

    public static async Task<IReadOnlyList<OutboxMessage>> Pending(Database database, CancellationToken ct)
    {
        await using var c = await database.Open(ct);
        await using var cmd = Sql.Command(c,null,"SELECT TOP(50) MessageId,RoutingKey,Payload FROM dbo.Outbox WHERE PublishedAt IS NULL ORDER BY CreatedAt");
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var messages = new List<OutboxMessage>();
        while (await r.ReadAsync(ct)) messages.Add(new(r.GetGuid(0),r.GetString(1),r.GetString(2)));
        return messages;
    }
    public static async Task MarkPublished(Database database, Guid id, CancellationToken ct)
    {
        await using var c = await database.Open(ct);
        await Sql.Execute(c,null,"UPDATE dbo.Outbox SET PublishedAt=SYSDATETIMEOFFSET() WHERE MessageId=@id AND PublishedAt IS NULL",ct,("@id",id));
    }
}
