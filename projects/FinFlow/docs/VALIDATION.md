# Registro de validação — 12/11/2026

## Executado

- SDK .NET 8.0.428 instalado para compilar o projeto.
- `dotnet build FinFlow.sln -c Release -m:1`: todos os cinco projetos compilados, sem avisos ou erros.
- `dotnet test`: 16 aprovados, 2 explicitamente ignorados por falta de FINFLOW_TEST_SQL.
- Casos .NET: conservação de saldo, limite/valor inválido, saldo insuficiente, titularidade, conta ausente, overflow, moeda, mesma conta, fingerprint, saldo exato e validação HTTP JWT. Ativação de JWT de desenvolvimento recusada em Production.
- `npm run typecheck`, `npm test` e `npm run build`: aprovados. 16 testes de valores e simulação, com idempotência, conflito de payload, reenvio, FIFO, saldo insuficiente, processamento automático e reinicialização.
- Builds separados de shell, transferências e indicadores; módulos carregados pelo shell como ES Modules.
- Verificação estrutural dos YAMLs e scripts; sem aplicação em cluster.

- Auditorias npm (incluindo ferramentas de desenvolvimento) e NuGet (incluindo dependências transitivas): nenhum aviso conhecido retornado após atualização das dependências nesta data. Auditorias refletem as bases consultadas, não uma garantia de ausência de falhas.

## Verificação da demonstração no navegador

Fila pausada e processada manualmente; transferência de R$ 1.250,00 concluída; saldo da origem R$ 23.250,00 e destino R$ 9.400,00, total R$ 32.650,00. O reenvio retornou o mesmo ID e preservou os saldos. Solicitação de R$ 23.350,00 recusada por saldo insuficiente, sem alteração de saldo. Filtro por recusadas, exportação CSV, navegação da arquitetura, reinício dos dados e processamento automático verificados. A busca do portfólio localizou o novo projeto.

## Pendente por infraestrutura

Não havia Docker, daemon de containers, SQL Server ou RabbitMQ disponíveis nesta sessão. Portanto, não foi executada uma transferência entre os serviços com persistência SQL e mensageria reais. Os testes SQL incluídos verificam concorrência/idempotência/isolamento, mas foram ignorados neste ambiente. A validação HTTP JWT usa o servidor ASP.NET Core de teste, sem banco ou broker.

`scripts/smoke.py` testa via HTTP o fluxo completo do Compose: JWT, resposta assíncrona, liquidação, reenvio, conflito, saldo insuficiente e conservação dos saldos. O workflow CI provisiona o ambiente para esses testes quando executado no GitHub; o fornecimento do workflow não comprova uma execução.

Também não foram executados: login em tenant Auth0 real, build de imagens Docker, aplicação em Kubernetes/AKS, testes de indisponibilidade de broker, recuperação após crash, benchmark ou avaliação de capacidade. Não são apresentadas métricas de alto volume ou resultados comerciais.

## Roteiro de aceitação

| Cenário | Resultado esperado |
| --- | --- |
| Duas operações concorrentes acima do saldo disponível | Uma conclusão e uma recusa; saldo nunca negativo |
| Duas entregas do mesmo TransferId | Um débito e um crédito, uma vez |
| Mesmo Idempotency-Key e mesmo conteúdo | Mesmo ID, sem nova operação |
| Mesmo Idempotency-Key com valor diferente | HTTP 409 |
| Token ausente, expirado ou assinatura inválida | HTTP 401 |
| Usuário consulta conta/operação alheia | Registro não retornado |
| Worker cai depois do commit, antes do ACK | Reentrega deduplicada |
| Broker indisponível e restaurado | Outbox pendente é publicada após recuperação |
| Mensagem inválida | DLQ; investigação antes de reprocessamento |
