using FinFlow.Core;
using FinFlow.Infrastructure;

var builder=WebApplication.CreateBuilder(args);
builder.AddPlatform("ledger");
var app=builder.Build();
if (args.Contains("--migrate") || app.Environment.IsDevelopment())
    await app.Services.GetRequiredService<Database>().Migrate("Ledger",CancellationToken.None);
if (args.Contains("--migrate")) return;
if (app.Environment.IsDevelopment() && app.Configuration.GetValue<bool>("SeedDemo"))
{
    using var scope=app.Services.CreateScope();
    await ((LedgerStore)scope.ServiceProvider.GetRequiredService<ILedgerStore>()).SeedDemo(CancellationToken.None);
}
app.MapPlatform();
var api=app.MapGroup("/api/accounts").RequireAuthorization("account-user");
api.MapGet("/",async (HttpContext context,ILedgerStore store,CancellationToken ct)=>
    Results.Ok(await store.List(context.User.FindFirst("sub")!.Value,ct)));
api.MapGet("/{id:guid}/entries",async (Guid id,HttpContext context,ILedgerStore store,CancellationToken ct)=>
    await store.Entries(context.User.FindFirst("sub")!.Value,id,ct) is { } entries ? Results.Ok(entries) : Results.NotFound());
app.Run();
