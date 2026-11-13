# Decisões de arquitetura

| Decisão | Implementação e motivo | Limite |
| --- | --- | --- |
| Dois serviços | Transações controla a solicitação; Ledger controla o saldo e os lançamentos. Bancos separados. | Workers estão hospedados junto às APIs para manter a primeira versão menor. |
| SQL Server com ADO.NET | Consultas parametrizadas explícitas e índices por proprietário/data, pendências e conta. | Sem ORM; migrações posteriores precisam de novas versões. |
| Centavos `long` / `bigint` | Evita arredondamento binário e rejeita valor inválido antes da gravação. | BRL somente; limite de valor explícito. |
| Transação serializável | Os saldos são lidos com UPDLOCK/HOLDLOCK e atualizados no mesmo commit. | Contas com muitas operações podem disputar locks; throughput deve ser medido. |
| Idempotência na entrada | Chave UUID única por usuário + fingerprint do conteúdo. Mesmo conteúdo retorna o registro; conteúdo diferente retorna 409. | Retenção da chave deve acompanhar a política de negócio. |
| Outbox | Estado e evento no mesmo commit SQL; publicação confirmada antes da marcação. | Publicação pode duplicar após falha; consumidores deduplicam. |
| Ledger idempotente | TransferId único em ProcessedTransfers e por conta nos lançamentos. | Não existe transação distribuída entre os dois bancos. |
| RabbitMQ | Exchanges direct, filas quorum, mensagens persistentes, publisher confirms, ACK após commit, limite de reentrega e DLQ. | Compose possui um único broker; não demonstra alta disponibilidade. |
| Consistência eventual | Cliente recebe 202 e consulta o resultado, que chega por evento. | Durante uma indisponibilidade o status pode permanecer Queued. |
| Auth0 / JWT | APIs validam emissor, audience, expiração e algoritmo. Titularidade pela claim sub; collation binária nas colunas de identidade preserva a distinção entre maiúsculas e minúsculas. | É preciso provisionar as contas de produção com o sub correto. |
| Microfrontends | Três builds, módulos ES e funções mount/unmount com contrato tipado. | Bundles incluem sua própria cópia de React; otimização possível após medir. |

## Contrato HTTP

| Método e caminho | Resposta principal | Autorização |
| --- | --- | --- |
| POST /api/transfers/ | 202 com operação Queued; 200 para repetição; 409 para conflito | JWT; Idempotency-Key UUID; até 60 envios/minuto por sub e instância |
| GET /api/transfers/?limit=50 | Até 100 operações recentes | Apenas o sub da sessão |
| GET /api/transfers/{id} | Operação ou 404 | Registro deve pertencer ao sub |
| GET /api/accounts/ | Contas e saldos | Apenas contas do sub |
| GET /api/accounts/{id}/entries | Até 100 lançamentos ou 404 | Conta deve pertencer ao sub |
| POST /dev/token | Token de demo-user | Exclusivamente Development + Auth:Mode=Development |
| GET /health/live | 200 | Público, sem dados internos |
| GET /health/ready | 200 ou 503 | Verifica banco e estado dos workers |

O limite de requisições é local a cada réplica. Para uma quota global, aplique uma política no gateway ou armazenamento distribuído. Não se usa um header de usuário fornecido pelo cliente para decidir titularidade.

## Contrato de eventos v1

`transfer.requested.v1`: MessageId, TransferId, Subject, SourceId, TargetId, AmountMinor, Currency, OccurredAt. Roteado para `ledger.requests`.

`transfer.result.v1`: MessageId, TransferId, Subject, Status, Reason, OccurredAt. Roteado para `transactions.results`.

Todos os JSONs usam camelCase. As DLQs são `ledger.requests.dead` e `transactions.results.dead`. Mensagens inválidas seguem diretamente para DLQ; falhas transitórias são reentregues com limite. Depois de corrigir a causa, revise a mensagem antes de republicá-la com o mesmo ID. Não faça reprocessamento cego de mensagens financeiras.

O transporte deve ser privado e autenticado. Em produção use `amqps`, credenciais próprias e permissões restritas ao vhost/exchanges/filas do FinFlow. Eventos contêm um identificador de usuário, sem dados de cartão, CPF ou credenciais. Logs evitam payloads e strings de conexão.

## Recuperação e operação

Se o broker cair, a API ainda consegue gravar a transferência e a Outbox enquanto o banco estiver disponível. Após a recuperação, o publisher tenta novamente. Se o worker cair após o commit e antes do ACK, a repetição encontra o TransferId já processado e confirma sem novo débito. Se a marcação de publicação falhar, a Outbox pode enviar novamente e a mesma proteção se aplica.

Quando o banco falha, a operação não deve ser confirmada. A entrega permanece pendente ou é reentregue. Após o limite do broker, uma mensagem pode precisar de intervenção na DLQ; acompanhe também solicitações Queued sem resultado, idade da Outbox e readiness. Defina backups, restauração e limpeza dos registros antes de operar fora do estudo.
