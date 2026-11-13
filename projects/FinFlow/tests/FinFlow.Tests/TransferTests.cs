using FinFlow.Core;
using Xunit;

namespace FinFlow.Tests;

public class TransferTests
{
    private static readonly Guid Source=Guid.Parse("11111111-1111-4111-8111-111111111111");
    private static readonly Guid Target=Guid.Parse("22222222-2222-4222-8222-222222222222");
    private static TransferRequested Request(long amount=2500,string subject="alice")=>new(Guid.NewGuid(),Guid.NewGuid(),subject,Source,Target,amount,"BRL",DateTimeOffset.UtcNow);
    private static Account Account(Guid id,long balance,string owner="alice")=>new(id,owner,"Test",balance,"BRL");

    [Fact] public void TransferConservesMoney()
    {
        var decision=TransferRules.Evaluate(Request(),Account(Source,10_000),Account(Target,2_000));
        Assert.True(decision.Accepted);
        Assert.Equal(7_500,decision.SourceBalance);
        Assert.Equal(4_500,decision.TargetBalance);
        Assert.Equal(12_000,decision.SourceBalance+decision.TargetBalance);
    }
    [Theory] [InlineData(0)] [InlineData(-1)] [InlineData(100_000_000_001)]
    public void InvalidAmountsAreRejected(long amount)=>Assert.False(TransferRules.Evaluate(Request(amount),Account(Source,long.MaxValue),Account(Target,0)).Accepted);
    [Fact] public void InsufficientFundsDoNotChangeBalances()
    {
        var d=TransferRules.Evaluate(Request(10001),Account(Source,10000),Account(Target,20));
        Assert.False(d.Accepted);Assert.Equal("insufficient_funds",d.Reason);Assert.Equal(10000,d.SourceBalance);Assert.Equal(20,d.TargetBalance);
    }
    [Fact] public void ForeignSourceIsRejected()=>Assert.Equal("source_not_available",TransferRules.Evaluate(Request(subject:"mallory"),Account(Source,10000),Account(Target,0)).Reason);
    [Fact] public void MissingTargetIsRejected()=>Assert.Equal("target_not_available",TransferRules.Evaluate(Request(),Account(Source,10000),null).Reason);
    [Fact] public void TargetOverflowIsRejected()=>Assert.Equal("balance_limit",TransferRules.Evaluate(Request(),Account(Source,10000),Account(Target,long.MaxValue)).Reason);
    [Fact] public void SameAccountIsRejected()=>Assert.Equal("same_account",TransferRules.Validate(new(Source,Source,100)));
    [Fact] public void DifferentCurrencyIsRejected()=>Assert.Equal("unsupported_currency",TransferRules.Validate(new(Source,Target,100,"USD")));
    [Fact] public void FingerprintChangesWhenAmountChanges()
    {
        Assert.Equal(TransferRules.Fingerprint(new(Source,Target,100)),TransferRules.Fingerprint(new(Source,Target,100)));
        Assert.NotEqual(TransferRules.Fingerprint(new(Source,Target,100)),TransferRules.Fingerprint(new(Source,Target,101)));
    }
    [Fact] public void ExactBalanceCanBeTransferred()=>Assert.Equal(0,TransferRules.Evaluate(Request(10000),Account(Source,10000),Account(Target,0)).SourceBalance);
}
