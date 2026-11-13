using FinFlow.Core;
using FinFlow.Infrastructure;

var builder=WebApplication.CreateBuilder(args);
builder.AddPlatform("transactions");
var app=builder.Build();
if (args.Contains("--migrate") || app.Environment.IsDevelopment())
    await app.Services.GetRequiredService<Database>().Migrate("Transactions",CancellationToken.None);
if (args.Contains("--migrate")) return;
app.MapPlatform();
var api=app.MapGroup("/api/transfers").RequireAuthorization("account-user");
api.MapPost("/",async (TransferInput input,HttpContext context,ITransactionsStore store,CancellationToken ct)=>
{
    if (TransferRules.Validate(input) is { } error)
        return Results.ValidationProblem(new Dictionary<string,string[]>{{"transfer",[error]}});
    if (!Guid.TryParseExact(context.Request.Headers["Idempotency-Key"],"D",out var key))
        return Results.ValidationProblem(new Dictionary<string,string[]>{{"Idempotency-Key",["A UUID in D format is required."]}});
    var subject=context.User.FindFirst("sub")!.Value;
    if (subject.Length>128) return Results.Forbid();
    try
    {
        var submission=await store.Submit(subject,key.ToString("D"),input,ct);
        context.Response.Headers["Idempotency-Replayed"]=submission.Replayed?"true":"false";
        return submission.Replayed ? Results.Ok(submission.Transfer) : Results.Accepted($"/api/transfers/{submission.Transfer.Id}",submission.Transfer);
    }
    catch (IdempotencyConflictException) { return Results.Conflict(new{code="idempotency_conflict",message="This key was already used for a different transfer."}); }
}).RequireRateLimiting("transfers").WithName("CreateTransfer");
api.MapGet("/",async (HttpContext context,ITransactionsStore store,int? limit,CancellationToken ct)=>
    Results.Ok(await store.List(context.User.FindFirst("sub")!.Value,Math.Clamp(limit??50,1,100),ct)));
api.MapGet("/{id:guid}",async (Guid id,HttpContext context,ITransactionsStore store,CancellationToken ct)=>
    await store.Get(context.User.FindFirst("sub")!.Value,id,ct) is { } transfer ? Results.Ok(transfer) : Results.NotFound());
app.Run();
