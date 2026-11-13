using FinFlow.Core;
using FinFlow.Infrastructure;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace FinFlow.Tests;

// Run only against a disposable database. CI's integration job provisions SQL Server explicitly.
public sealed class SqlFactAttribute : FactAttribute
{
    public SqlFactAttribute() { if (string.IsNullOrEmpty(System.Environment.GetEnvironmentVariable("FINFLOW_TEST_SQL"))) Skip="Set FINFLOW_TEST_SQL to run against disposable SQL Server."; }
}
public class SqlIntegrationTests
{
    private static Database Db(string name)=>new(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>
    {{"ConnectionStrings:Database",new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(System.Environment.GetEnvironmentVariable("FINFLOW_TEST_SQL")){InitialCatalog=name}.ConnectionString}}).Build());

    [SqlFact] public async Task ReplayAndConcurrencyCannotDoubleDebit()
    {
        var ct=CancellationToken.None;
        var db=Db("FinFlowLedger");await db.Migrate("Ledger",ct);
        var store=new LedgerStore(db);
        var source=Guid.NewGuid();var target=Guid.NewGuid();var subject="owner-"+Guid.NewGuid().ToString();
        await using (var c=await db.Open(ct)) await Sql.Execute(c,null,"INSERT dbo.Accounts(Id,Owner,Name,BalanceMinor,Currency) VALUES(@s,@owner,'Source',10000,'BRL'),(@t,@owner,'Target',0,'BRL')",ct,("@s",source),("@t",target),("@owner",subject));
        var a=new TransferRequested(Guid.NewGuid(),Guid.NewGuid(),subject,source,target,7500,"BRL",DateTimeOffset.UtcNow);
        var b=a with{TransferId=Guid.NewGuid(),MessageId=Guid.NewGuid()};
        await Task.WhenAll(store.Apply(a,ct),store.Apply(a,ct),store.Apply(b,ct));
        var accounts=await store.List(subject,ct);
        Assert.Equal(2500,accounts.Single(x=>x.Id==source).BalanceMinor);
        Assert.Equal(7500,accounts.Single(x=>x.Id==target).BalanceMinor);
        var entries=await store.Entries(subject,source,ct);Assert.Single(entries!);
        Assert.Null(await store.Entries("another-user",source,ct));
    }
    [SqlFact] public async Task IdempotencyIsScopedAndRejectsChangedPayload()
    {
        var ct=CancellationToken.None;var db=Db("FinFlowTransactions");await db.Migrate("Transactions",ct);
        var store=new TransactionsStore(db);var subject="owner-"+Guid.NewGuid().ToString();var key=Guid.NewGuid().ToString();
        var input=new TransferInput(Guid.NewGuid(),Guid.NewGuid(),12345);
        var submitted=await Task.WhenAll(store.Submit(subject,key,input,ct),store.Submit(subject,key,input,ct));
        Assert.Equal(submitted[0].Transfer.Id,submitted[1].Transfer.Id);Assert.Single(submitted,s=>!s.Replayed);
        await Assert.ThrowsAsync<IdempotencyConflictException>(()=>store.Submit(subject,key,input with{AmountMinor=12346},ct));
        Assert.Null(await store.Get("foreign-owner",submitted[0].Transfer.Id,ct));
        Assert.Null(await store.Get(subject.ToUpperInvariant(),submitted[0].Transfer.Id,ct));
    }
}
