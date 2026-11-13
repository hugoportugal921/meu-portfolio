using FinFlow.Core;
using Microsoft.Data.SqlClient;

namespace FinFlow.Infrastructure;

public sealed class TransactionsStore(Database database) : ITransactionsStore
{
    private const string Columns = "Id,Subject,IdempotencyKey,Fingerprint,SourceId,TargetId,AmountMinor,Currency,Status,Reason,CreatedAt,SettledAt";
    public Task<Submission> Submit(string subject, string key, TransferInput input, CancellationToken ct) => database.Atomic(async (c, tx) =>
    {
        if (TransferRules.Validate(input) is { } error) throw new ArgumentException(error);
        await using var find = Sql.Command(c, tx, $"SELECT {Columns} FROM dbo.Transfers WITH(UPDLOCK,HOLDLOCK) WHERE Subject=@subject AND IdempotencyKey=@key", ("@subject",subject),("@key",key));
        Transfer? old;
        await using (var r = await find.ExecuteReaderAsync(ct)) old = await r.ReadAsync(ct) ? Read(r) : null;
        var fingerprint = TransferRules.Fingerprint(input);
        if (old is not null)
        {
            if (old.Fingerprint != fingerprint) throw new IdempotencyConflictException();
            return new Submission(old, true);
        }
        var now = DateTimeOffset.UtcNow;
        var transfer = new Transfer(Guid.NewGuid(),subject,key,fingerprint,input.SourceId,input.TargetId,input.AmountMinor,input.Currency,"Queued",null,now,null);
        await Sql.Execute(c,tx,"INSERT dbo.Transfers(Id,Subject,IdempotencyKey,Fingerprint,SourceId,TargetId,AmountMinor,Currency,Status,CreatedAt) VALUES(@id,@subject,@key,@fp,@source,@target,@amount,@currency,'Queued',@now)",ct,
            ("@id",transfer.Id),("@subject",subject),("@key",key),("@fp",fingerprint),("@source",input.SourceId),("@target",input.TargetId),("@amount",input.AmountMinor),("@currency",input.Currency),("@now",now));
        await Outbox.Add(c,tx,transfer.Id,Routes.Requested,new TransferRequested(transfer.Id,transfer.Id,subject,input.SourceId,input.TargetId,input.AmountMinor,input.Currency,now),ct);
        return new Submission(transfer,false);
    },ct);

    public async Task<IReadOnlyList<Transfer>> List(string subject, int limit, CancellationToken ct)
    {
        await using var c = await database.Open(ct);
        await using var cmd = Sql.Command(c,null,$"SELECT TOP(@limit) {Columns} FROM dbo.Transfers WHERE Subject=@subject ORDER BY CreatedAt DESC,Id",("@limit",limit),("@subject",subject));
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var result = new List<Transfer>();
        while (await r.ReadAsync(ct)) result.Add(Read(r));
        return result;
    }
    public async Task<Transfer?> Get(string subject, Guid id, CancellationToken ct)
    {
        await using var c = await database.Open(ct);
        await using var cmd = Sql.Command(c,null,$"SELECT {Columns} FROM dbo.Transfers WHERE Id=@id AND Subject=@subject",("@id",id),("@subject",subject));
        await using var r = await cmd.ExecuteReaderAsync(ct);
        return await r.ReadAsync(ct) ? Read(r) : null;
    }
    public async Task Apply(TransferResult result, CancellationToken ct)
    {
        if (result.Status is not ("Completed" or "Rejected")) throw new ArgumentException("invalid_result");
        await database.Atomic(async (c,tx) =>
        {
            await using var check = Sql.Command(c,tx,"SELECT MessageId FROM dbo.Inbox WITH(UPDLOCK,HOLDLOCK) WHERE MessageId=@id",("@id",result.MessageId));
            if (await check.ExecuteScalarAsync(ct) is not null) return false;
            await using var update = Sql.Command(c,tx,"UPDATE dbo.Transfers SET Status=@status,Reason=@reason,SettledAt=@now WHERE Id=@id AND Subject=@subject AND Status='Queued'",("@status",result.Status),("@reason",result.Reason),("@now",result.OccurredAt),("@id",result.TransferId),("@subject",result.Subject));
            await update.ExecuteNonQueryAsync(ct);
            await Sql.Execute(c,tx,"INSERT dbo.Inbox VALUES(@id,@now)",ct,("@id",result.MessageId),("@now",DateTimeOffset.UtcNow));
            return true;
        },ct);
    }
    private static Transfer Read(SqlDataReader r) => new(r.GetGuid(0),r.GetString(1),r.GetString(2),r.GetString(3),r.GetGuid(4),r.GetGuid(5),r.GetInt64(6),r.GetString(7),r.GetString(8),r.IsDBNull(9)?null:r.GetString(9),r.GetFieldValue<DateTimeOffset>(10),r.IsDBNull(11)?null:r.GetFieldValue<DateTimeOffset>(11));
}
