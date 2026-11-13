# Hugo Portugal — Portfólio profissional

**[Acessar o portfólio](https://hugoportugal921.github.io/meu-portfolio/)** · [Código-fonte do FinFlow](projects/FinFlow/README.md) · [Projeto Power BI](projects/AtlasBI/)

Portfólio de Hugo Portugal Vasconcelos, com projetos independentes de desenvolvimento de software, análise de dados e automação. A página apresenta o problema de cada projeto, a abordagem técnica e o que pode ser avaliado como estudo, código ou demonstração.

## Projetos em destaque

| Projeto | O que está disponível |
| --- | --- |
| SIGB | Estudo de requisitos e arquitetura para gestão de bolsas; solução em planejamento. |
| SIGSST | Demonstração interativa com indicadores, ações e inventário ilustrativo de riscos. |
| Painel operacional | Filtros, indicadores e gráficos com dados simulados. |
| Consolidação de dados | Importação de CSV, validação e geração de relatórios no navegador. |
| Vídeo analítico | Detecção de movimento por diferenças entre quadros, sem reconhecimento de pessoas ou EPIs. |
| Atlas BI | Projeto Power BI com Power Query, modelo em estrela, DAX e relatório; inclui prévia web e pacote técnico. |
| FinFlow | Código .NET 8, SQL Server, RabbitMQ e React; demonstração de transferências internas com dados simulados. |

## Demonstrações e código

- [FinFlow — demonstração](https://hugoportugal921.github.io/meu-portfolio/finflow/) e [código](projects/FinFlow/README.md).
- [Atlas BI — prévia](https://hugoportugal921.github.io/meu-portfolio/powerbi/) e [arquivos Power BI](projects/AtlasBI/).
- [Consolidação de dados](https://hugoportugal921.github.io/meu-portfolio/projetos/consolidacao-dados/).
- [Dashboard operacional](https://hugoportugal921.github.io/meu-portfolio/projetos/dashboard-operacional/).
- [Vídeo analítico](https://hugoportugal921.github.io/meu-portfolio/projetos/video-analitico/).
- [Laboratório SQL](https://hugoportugal921.github.io/meu-portfolio/projetos/laboratorio-sql/).

As demonstrações estáticas utilizam dados fictícios e não exigem autenticação. O FinFlow hospedado no GitHub Pages funciona no navegador; os serviços .NET, SQL Server e RabbitMQ são executados separadamente, conforme seu README. Auth0 e AKS dependem de ambiente configurado. O registro de validação diferencia os testes executados das integrações pendentes.

O Atlas BI inclui um projeto nativo para abrir no Power BI Desktop. A prévia web não é um relatório Power BI incorporado; a execução do modelo e a publicação no Power BI Service precisam ser validadas no respectivo ambiente.

## Organização

- `docs/`: arquivos publicados pelo GitHub Pages, prévias, demonstrações e downloads.
- `projects/FinFlow/`: APIs, regras de negócio, testes, microfrontends, Docker e preparação para AKS.
- `projects/AtlasBI/`: fontes e arquivos do projeto Power BI.
- `docs/catalogo-anterior.html`, `perfil.html` e `ecossistema.html`: apresentação anterior e páginas preservadas.

Os repositórios originais das quatro demonstrações anteriores mantêm suas configurações de acesso. Os arquivos publicados neste repositório são os materiais autorizados para o portfólio.

## Executar e verificar

Para o portfólio estático, use Node.js 20 ou superior. Não há dependências a instalar na raiz.

```sh
npm test
npm run build
npm start
```

Abra http://127.0.0.1:4173. No Windows, `iniciar.cmd` inicia o mesmo servidor. Para executar os serviços do FinFlow e os testes .NET/React, siga [o procedimento do projeto](projects/FinFlow/README.md).

## Publicação

O GitHub Pages publica a pasta `docs` da branch `main`. Os caminhos são compatíveis com o subdiretório `/meu-portfolio/`. O arquivo `.nojekyll` mantém a publicação estática. O endereço público não utiliza domínio do ChatGPT.

As licenças OFL das fontes usadas nas demonstrações anteriores e a licença do sql.js foram preservadas nos diretórios correspondentes.
