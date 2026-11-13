using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;

namespace FinFlow.Infrastructure;

public static class Security
{
    public static IServiceCollection AddFinFlowAuth(this IServiceCollection services, IConfiguration config, IHostEnvironment environment)
    {
        var development = config["Auth:Mode"] == "Development";
        if (development && !environment.IsDevelopment())
            throw new InvalidOperationException("Development JWT is forbidden outside Development.");
        if (development && Encoding.UTF8.GetByteCount(config["Auth:SigningKey"] ?? "") < 32)
            throw new InvalidOperationException("Development requires a random signing key of at least 32 bytes.");
        var authority = config["Auth0:Authority"];
        var audience = config["Auth0:Audience"];
        if (!development && (!Uri.TryCreate(authority,UriKind.Absolute,out var uri) || uri.Scheme!="https" || string.IsNullOrWhiteSpace(audience)))
            throw new InvalidOperationException("Set HTTPS Auth0__Authority and Auth0__Audience.");
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
        {
            options.MapInboundClaims=false;
            options.RequireHttpsMetadata=true;
            if (development)
            {
                options.TokenValidationParameters = new()
                {
                    ValidateIssuerSigningKey=true,IssuerSigningKey=new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Auth:SigningKey"]!)),
                    ValidateIssuer=true,ValidIssuer="finflow-local",ValidateAudience=true,ValidAudience="finflow-api",
                    ValidateLifetime=true,ClockSkew=TimeSpan.FromSeconds(15),ValidAlgorithms=[SecurityAlgorithms.HmacSha256]
                };
            }
            else
            {
                options.Authority=authority;
                options.Audience=audience;
                options.TokenValidationParameters.ValidAlgorithms=[SecurityAlgorithms.RsaSha256];
                options.TokenValidationParameters.ClockSkew=TimeSpan.FromSeconds(30);
            }
        });
        services.AddAuthorization(options => options.AddPolicy("account-user",policy => policy.RequireAuthenticatedUser().RequireClaim("sub")));
        return services;
    }
    public static string DemoToken(string signingKey) => new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
        issuer:"finflow-local",audience:"finflow-api",claims:[new Claim("sub","demo-user"),new Claim("jti",Guid.NewGuid().ToString())],
        notBefore:DateTime.UtcNow,expires:DateTime.UtcNow.AddHours(1),
        signingCredentials:new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),SecurityAlgorithms.HmacSha256)));
}
