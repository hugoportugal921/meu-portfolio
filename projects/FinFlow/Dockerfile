FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG SERVICE=Transactions
WORKDIR /source
COPY Directory.Build.props global.json ./
COPY src ./src
RUN dotnet publish src/FinFlow.${SERVICE}.Api/FinFlow.${SERVICE}.Api.csproj -c Release -o /out -m:1

FROM mcr.microsoft.com/dotnet/aspnet:8.0
ARG SERVICE=Transactions
ENV FINFLOW_SERVICE=${SERVICE} ASPNETCORE_HTTP_PORTS=8080
WORKDIR /app
COPY --from=build /out .
COPY scripts/entrypoint.sh /entrypoint.sh
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["sh","/entrypoint.sh"]
