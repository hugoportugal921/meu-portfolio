# Implantação com Auth0 e AKS

Os arquivos de AKS são preparação executável por ambiente. Nenhum recurso Azure foi criado ou testado nesta sessão.

## Pré-requisitos

1. Cluster AKS existente, acesso kubectl e Metrics Server. Habilite o add-on de application routing para a classe `webapprouting.kubernetes.azure.com`, ou ajuste a classe para seu controlador.
2. ACR existente e identidade do AKS com permissão de pull. Configure acesso de rede aos bancos, RabbitMQ, DNS e endpoints HTTPS do Auth0.
3. SQL Server com os bancos `FinFlowTransactions` e `FinFlowLedger`. O baseline só suporta esses nomes. O migrador conecta também ao banco master; em um SQL Server gerenciado, conceda esse acesso à identidade de migração. Para Azure SQL Database com bancos isolados, aplique os scripts SQL diretamente em cada banco e não use o modo `--migrate` deste exemplo.
4. RabbitMQ 4.1 compatível com quorum queues e AMQPS com certificado válido. Use um cluster de broker se o ambiente exigir alta disponibilidade.
5. Tenant Auth0, aplicação SPA e API RS256. Configure Allowed Callback URLs, Allowed Logout URLs e Allowed Web Origins com a origem HTTPS do FinFlow. Use o mesmo audience no React e nas duas APIs.
6. Namespace `finflow`, secrets `finflow-runtime`, `finflow-migrations` e certificado `finflow-tls`. [secrets.example.yaml](../deploy/k8s/secrets.example.yaml) contém os nomes esperados, sem credenciais utilizáveis. Materialize os segredos por cofre ou gerenciador de segredos.

As contas reais não são criadas pela interface. Provisione `Accounts.Owner` com a claim `sub` de quem utilizará o sistema e saldos de teste autorizados. `SeedDemo` fica desligado em produção. O endpoint `/dev/token` não existe em Production.

## Permissões do banco

Use identidades diferentes para migração e runtime. O runtime precisa SELECT, INSERT e UPDATE nas tabelas do próprio banco; não necessita CREATE DATABASE, ALTER ou acesso ao outro banco. A migração precisa aplicar as tabelas/índices/constraints e registrar SchemaVersions. Use TLS com TrustServerCertificate=False e armazene as strings de conexão fora do Git.

## Build e publicação

O workflow `.github/workflows/cd-aks.yml` é manual e usa Azure OIDC, sem senha Azure no repositório. Configure o environment GitHub `staging` com proteção/aprovação conforme sua equipe e uma credencial federada que corresponda a esse environment.

Variáveis necessárias: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AKS_CLUSTER`, `ACR_NAME`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_AUDIENCE` e `FINFLOW_HOSTNAME`.

O fluxo cria três imagens com o SHA do commit, publica no ACR, renderiza os templates, aplica os recursos, executa as migrações e espera o rollout. O namespace e os segredos devem existir antes da primeira execução. A identidade do workflow precisa push no ACR e permissões limitadas ao namespace no AKS. Ajuste as autorizações ao seu ambiente; não conceda papel administrativo por conveniência.

Para renderizar e revisar manualmente, exporte `REGISTRY`, `TAG`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` e `FINFLOW_HOSTNAME` e execute `python3 scripts/render-k8s.py`. Revise `.deploy/runtime.yaml` e `.deploy/migrations.yaml` antes de aplicar. Não use valores fictícios em um cluster real.

O frontend recebe as variáveis públicas Auth0 no **build**, não em tempo de execução. Refaça a imagem ao mudar domínio/client ID/audience. Nenhum segredo de cliente é necessário para uma SPA.

## Verificar e recuperar

Espere Jobs completos e pods prontos. Teste login real, rejeição de token inválido, isolamento por usuário, criação/reenvio de transferência, saldos e entradas. Faça teste de interrupção do broker e reinício dos workers em ambiente de teste, acompanhando a Outbox e as DLQs.

O HPA escala o Ledger entre duas e seis réplicas por CPU. É uma configuração inicial a calibrar; CPU não mede atraso da fila. Em produção monitore também fila, idade das pendências, erros, latência e contenção SQL. A implantação não inclui observabilidade hospedada, alertas, políticas de rede específicas do cluster ou provisionamento de backup.

Para rollback de código, selecione uma imagem anterior e acompanhe o rollout. Migrações não são desfeitas automaticamente; mantenha compatibilidade com a versão anterior e valide restauração de backup. Fixe imagens base por digest após a revisão de vulnerabilidades do ambiente de destino.
