using System.Data;
using System.Reflection;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace FinFlow.Infrastructure;

public sealed class Database(IConfiguration configuration)
{
    public string ConnectionString => configuration.GetConnectionString("Database")
        ?? throw new InvalidOperationException("ConnectionStrings__Database is required.");

    public async Task<SqlConnection> Open(CancellationToken ct)
    {
        var connection = new SqlConnection(ConnectionString);
        try { await connection.OpenAsync(ct); return connection; }
        catch { await connection.DisposeAsync(); throw; }
    }

    public async Task<T> Atomic<T>(Func<SqlConnection, SqlTransaction, Task<T>> action, CancellationToken ct)
    {
        for (var attempt = 0; ; attempt++)
        {
            await using var c = await Open(ct);
            await using var tx = (SqlTransaction)await c.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            try
            {
                var result = await action(c, tx);
                await tx.CommitAsync(ct);
                return result;
            }
            catch (SqlException e) when ((e.Number == 1205 || e.Number == 1222) && attempt < 3)
            {
                try { await tx.RollbackAsync(CancellationToken.None); } catch (InvalidOperationException) { /* SQL Server already rolled back a deadlock victim. */ }
                await Task.Delay(TimeSpan.FromMilliseconds(80 * (attempt + 1) + Random.Shared.Next(80)), ct);
            }
        }
    }

    public async Task Migrate(string schema, CancellationToken ct)
    {
        var b = new SqlConnectionStringBuilder(ConnectionString);
        var databaseName = b.InitialCatalog;
        if (databaseName is not ("FinFlowTransactions" or "FinFlowLedger"))
            throw new InvalidOperationException("Migration only supports the two FinFlow databases.");
        b.InitialCatalog = "master";
        await using (var master = new SqlConnection(b.ConnectionString))
        {
            await master.OpenAsync(ct);
            await using var create = master.CreateCommand();
            create.CommandText = $"IF DB_ID(@name) IS NULL CREATE DATABASE [{databaseName}]";
            create.Parameters.AddWithValue("@name", databaseName);
            await create.ExecuteNonQueryAsync(ct);
        }
        await using var c = await Open(ct);
        await using var tx = (SqlTransaction)await c.BeginTransactionAsync(ct);
        // One explicit baseline, immutable after release. Add versioned migrations for subsequent changes.
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream($"FinFlow.Infrastructure.Schemas.{schema}.sql")!;
        using var reader = new StreamReader(stream);
        await using var cmd = Sql.Command(c, tx, await reader.ReadToEndAsync(ct));
        await cmd.ExecuteNonQueryAsync(ct);
        await tx.CommitAsync(ct);
    }
}

public static class Sql
{
    public static SqlCommand Command(SqlConnection c, SqlTransaction? tx, string text, params (string, object?)[] args)
    {
        var cmd = new SqlCommand(text, c, tx) { CommandTimeout = 20 };
        foreach (var (key, value) in args) cmd.Parameters.AddWithValue(key, value ?? DBNull.Value);
        return cmd;
    }
    public static async Task Execute(SqlConnection c, SqlTransaction? tx, string text, CancellationToken ct, params (string, object?)[] args)
    {
        await using var cmd = Command(c, tx, text, args);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
