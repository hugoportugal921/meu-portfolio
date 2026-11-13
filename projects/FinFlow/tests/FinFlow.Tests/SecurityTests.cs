using System.Net;
using System.Net.Http.Headers;
using FinFlow.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace FinFlow.Tests;

public class SecurityTests
{
    private const string Key="test-only-key-32-bytes-minimum-do-not-deploy";
    private static IConfiguration Config()=>new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Auth:Mode","Development"},{"Auth:SigningKey",Key}}).Build();
    private sealed class Environment(string name) : IHostEnvironment
    {
        public string EnvironmentName {get;set;}=name;
        public string ApplicationName {get;set;}="Tests";
        public string ContentRootPath {get;set;}=".";
        public IFileProvider ContentRootFileProvider {get;set;}=new NullFileProvider();
    }
    [Fact] public void DevelopmentTokensCannotBeEnabledInProduction()=>Assert.Throws<InvalidOperationException>(()=>new ServiceCollection().AddFinFlowAuth(Config(),new Environment("Production")));
    [Theory] [InlineData(null,401)] [InlineData("bad-token",401)] [InlineData("valid",200)]
    public async Task JwtIsRequired(string? token,int expected)
    {
        using var server=new TestServer(new WebHostBuilder().UseEnvironment("Development").ConfigureServices(services=>
        {
            services.AddRouting();services.AddFinFlowAuth(Config(),new Environment("Development"));
        }).Configure(app=>
        {
            app.UseRouting();app.UseAuthentication();app.UseAuthorization();
            app.UseEndpoints(endpoints=>endpoints.MapGet("/protected",()=>"ok").RequireAuthorization("account-user"));
        }));
        using var client=server.CreateClient();
        if (token is not null) client.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",token=="valid"?Security.DemoToken(Key):token);
        Assert.Equal((HttpStatusCode)expected,(await client.GetAsync("/protected")).StatusCode);
    }
}
