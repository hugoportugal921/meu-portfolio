using FinFlow.Core;
using Microsoft.Data.SqlClient;

namespace FinFlow.Infrastructure;

public sealed class LedgerStore(Database database) : ILedgerStore
{
    public async Task<IReadOnlyList<Account>> List(string subject, CancellationToken ct)
    {
        await using var c = await database.Open(ct);
        await using var cmd = Sql.Command(c,null,"SELECT Id,Owner,Name,BalanceMinor,Currency FROM dbo.Accounts WHERE Owner=@subject ORDER BY Name",("@subject",subject));
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var accounts = new List<Account>();
        while (await r.ReadAsync(ct)) accounts.Add(Read(r));
        return accounts;
    }
    public async Task<IReadOnlyList<Entry>?> Entries(string subject, Guid accountId, CancellationToken ct)
    {
        await using var c = await database.Open(ct);
        await using var owner = Sql.Command(c,null,"SELECT 1 FROM dbo.Accounts WHERE Id=@id AND Owner=@subject",("@id",accountId),("@subject",subject));
        if (await owner.ExecuteScalarAsync(ct) is null) return null;
        await using var cmd = Sql.Command(c,null,"SELECT TOP(100) Id,TransferId,AccountId,AmountMinor,CreatedAt FROM dbo.Entries WHERE AccountId=@id ORDER BY CreatedAt DESC,Id DESC",("@id",accountId));
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var entries = new List<Entry>();
        while (await r.ReadAsync(ct)) entries.Add(new(r.GetInt64(0),r.GetGuid(1),r.GetGuid(2),r.GetInt64(3),r.GetFieldValue<DateTimeOffset>(4)));
        return entries;
    }
    public async Task Apply(TransferRequested request, CancellationToken ct)
    {
        await database.Atomic(async (c,tx) =>
        {
            await using var check = Sql.Command(c,tx,"SELECT TransferId FROM dbo.ProcessedTransfers WITH(UPDLOCK,HOLDLOCK) WHERE TransferId=@id",("@id",request.TransferId));
            if (await check.ExecuteScalarAsync(ct) is not null) return false;
            var accounts = new Dictionary<Guid,Account>();
            // Acquire account locks in a deterministic order to reduce opposing-transfer deadlocks.
            foreach (var id in new[]{request.SourceId,request.TargetId}.Distinct().Order())
            {
                await using var find = Sql.Command(c,tx,"SELECT Id,Owner,Name,BalanceMinor,Currency FROM dbo.Accounts WITH(UPDLOCK,HOLDLOCK) WHERE Id=@id",("@id",id));
                await using var r = await find.ExecuteReaderAsync(ct);
                if (await r.ReadAsync(ct)) accounts[id]=Read(r);
            }
            var decision = TransferRules.Evaluate(request,accounts.GetValueOrDefault(request.SourceId),accounts.GetValueOrDefault(request.TargetId));
            var now = DateTimeOffset.UtcNow;
            if (decision.Accepted)
            {
                await Sql.Execute(c,tx,"UPDATE dbo.Accounts SET BalanceMinor=@sourceBalance WHERE Id=@source; UPDATE dbo.Accounts SET BalanceMinor=@targetBalance WHERE Id=@target; INSERT dbo.Entries(TransferId,AccountId,AmountMinor,CreatedAt) VALUES(@transfer,@source,-@amount,@now),(@transfer,@target,@amount,@now);",ct,
                    ("@sourceBalance",decision.SourceBalance),("@targetBalance",decision.TargetBalance),("@source",request.SourceId),("@target",request.TargetId),("@transfer",request.TransferId),("@amount",request.AmountMinor),("@now",now));
            }
            await Sql.Execute(c,tx,"INSERT dbo.ProcessedTransfers VALUES(@transfer,@message,@now)",ct,("@transfer",request.TransferId),("@message",request.MessageId),("@now",now));
            var result = new TransferResult(Guid.NewGuid(),request.TransferId,request.Subject,decision.Accepted?"Completed":"Rejected",decision.Reason,now);
            await Outbox.Add(c,tx,result.MessageId,Routes.Result,result,ct);
            return true;
        },ct);
    }

    public async Task SeedDemo(CancellationToken ct)
    {
        await using var c = await database.Open(ct);
        await Sql.Execute(c,null,"IF NOT EXISTS(SELECT 1 FROM dbo.Accounts WHERE Id='11111111-1111-4111-8111-111111111111') INSERT dbo.Accounts(Id,Owner,Name,BalanceMinor,Currency) VALUES('11111111-1111-4111-8111-111111111111','demo-user',N'Conta operacional',2450000,'BRL'); IF NOT EXISTS(SELECT 1 FROM dbo.Accounts WHERE Id='22222222-2222-4222-8222-222222222222') INSERT dbo.Accounts(Id,Owner,Name,BalanceMinor,Currency) VALUES('22222222-2222-4222-8222-222222222222','demo-user',N'Reserva de projetos',815000,'BRL');",ct);
    }
    private static Account Read(SqlDataReader r) => new(r.GetGuid(0),r.GetString(1),r.GetString(2),r.GetInt64(3),r.GetString(4));
}
