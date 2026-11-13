using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace FinFlow.Core;

public record TransferInput(Guid SourceId, Guid TargetId, long AmountMinor, string Currency = "BRL");
public record Account(Guid Id, string Owner, string Name, long BalanceMinor, string Currency);
public record Entry(long Id, Guid TransferId, Guid AccountId, long AmountMinor, DateTimeOffset CreatedAt);
public record Transfer(Guid Id, string Subject, string IdempotencyKey, string Fingerprint,
    Guid SourceId, Guid TargetId, long AmountMinor, string Currency, string Status,
    string? Reason, DateTimeOffset CreatedAt, DateTimeOffset? SettledAt);
public record TransferRequested(Guid MessageId, Guid TransferId, string Subject,
    Guid SourceId, Guid TargetId, long AmountMinor, string Currency, DateTimeOffset OccurredAt);
public record TransferResult(Guid MessageId, Guid TransferId, string Subject,
    string Status, string? Reason, DateTimeOffset OccurredAt);
public record OutboxMessage(Guid MessageId, string RoutingKey, string Payload);
public record Submission(Transfer Transfer, bool Replayed);
public record Decision(bool Accepted, string? Reason, long SourceBalance, long TargetBalance);
public class IdempotencyConflictException : Exception;

public static class TransferRules
{
    public const long MaximumAmount = 100_000_000_000;
    public static string? Validate(TransferInput input)
    {
        if (input.SourceId == Guid.Empty || input.TargetId == Guid.Empty) return "invalid_account";
        if (input.SourceId == input.TargetId) return "same_account";
        if (input.AmountMinor <= 0 || input.AmountMinor > MaximumAmount) return "invalid_amount";
        return input.Currency == "BRL" ? null : "unsupported_currency";
    }
    public static string Fingerprint(TransferInput input) => Convert.ToHexString(SHA256.HashData(
        Encoding.UTF8.GetBytes($"{input.SourceId:D}|{input.TargetId:D}|{input.AmountMinor.ToString(CultureInfo.InvariantCulture)}|{input.Currency}")));

    public static Decision Evaluate(TransferRequested request, Account? source, Account? target)
    {
        string? reason = Validate(new(request.SourceId, request.TargetId, request.AmountMinor, request.Currency));
        if (reason is not null) return new(false, reason, 0, 0);
        // Authorize again at the point where money would move. Never trust an ID supplied by a client.
        if (source is null || source.Owner != request.Subject) return new(false, "source_not_available", 0, 0);
        if (target is null || target.Currency != request.Currency || source.Currency != request.Currency)
            return new(false, "target_not_available", source.BalanceMinor, 0);
        if (source.BalanceMinor < request.AmountMinor)
            return new(false, "insufficient_funds", source.BalanceMinor, target.BalanceMinor);
        if (target.BalanceMinor > long.MaxValue - request.AmountMinor)
            return new(false, "balance_limit", source.BalanceMinor, target.BalanceMinor);
        return new(true, null, source.BalanceMinor - request.AmountMinor, target.BalanceMinor + request.AmountMinor);
    }
}

public interface ITransactionsStore
{
    Task<Submission> Submit(string subject, string key, TransferInput input, CancellationToken ct);
    Task<IReadOnlyList<Transfer>> List(string subject, int limit, CancellationToken ct);
    Task<Transfer?> Get(string subject, Guid id, CancellationToken ct);
    Task Apply(TransferResult result, CancellationToken ct);
}
public interface ILedgerStore
{
    Task<IReadOnlyList<Account>> List(string subject, CancellationToken ct);
    Task<IReadOnlyList<Entry>?> Entries(string subject, Guid accountId, CancellationToken ct);
    Task Apply(TransferRequested request, CancellationToken ct);
}
public static class Routes
{
    public const string Requested = "transfer.requested.v1";
    public const string Result = "transfer.result.v1";
}
