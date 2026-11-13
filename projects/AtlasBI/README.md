# Atlas BI — Vendas, Margem e Metas

Projeto independente de Power BI para o portfólio de Hugo Portugal Vasconcelos.
A amostra é inteiramente sintética: não representa clientes, faturamento ou resultados de empresas.

## O que foi entregue

- Projeto `AtlasBI.pbip` com modelo semântico `model.bim` (TMSL) e relatório PBIR de quatro páginas.
- Power Query M para importar CSV, padronizar tipos, remover registros inválidos e IDs duplicados, calcular receita e custo.
- Modelo em estrela: quatro dimensões compartilhadas, duas tabelas fato e relacionamentos unidirecionais.
- 18 medidas DAX, incluindo margem ponderada, ticket médio, metas, YTD e comparação anual.
- Segmentações, gráficos, cartões e tabela de rastreabilidade no relatório nativo.
- Função de RLS dinâmica por unidade, com identidades fictícias para teste.
- Tema visual, arquivos CSV, consultas M e DAX, valores de controle e roteiro de publicação.

## Abrir no Power BI Desktop

1. Extraia o ZIP em uma pasta curta, por exemplo `C:\Projetos\AtlasBI`.
2. Abra `AtlasBI.pbip` no Power BI Desktop atualizado. Habilite os recursos de projetos PBIP/PBIR, se solicitados pela versão instalada.
3. Clique em Atualizar. Os CSVs da amostra estão incorporados ao modelo: não é necessário configurar um caminho local ou informar credenciais.
4. Confira os totais em `documentacao/valores_controle.json` e navegue pelas quatro páginas.
5. Se desejar aplicar a identidade visual, importe `AtlasBI_Tema.json` no menu de temas.
6. Salve o projeto no Desktop e, se precisar de um PBIX, use Salvar como no próprio aplicativo.

## Situação de validação

Os CSVs, as chaves, os relacionamentos, as reconciliações e os schemas JSON PBIP/PBIR são verificados automaticamente. O projeto foi gerado em ambiente Linux; sua abertura, a execução de M/DAX e a renderização nativa devem ser validadas no Power BI Desktop. A prévia do site usa JavaScript e reproduz os cálculos de referência; ela não é um relatório Power BI incorporado.

Publicação no Power BI Service, permissões de usuários, credenciais, gateway e agenda de atualização ainda dependem da conta e da infraestrutura de destino. Não foram configurados em um tenant Microsoft.

## Convenções que afetam a análise

- FatoVendas: uma linha por item de pedido. PedidoID pode aparecer mais de uma vez; ItemID é único.
- Pedidos usa DISTINCTCOUNT; somar contagens de pedidos de categorias diferentes pode duplicar pedidos.
- FatoMetas: uma linha por mês e unidade. A data da meta corresponde ao primeiro dia do mês. Compare períodos mensais completos.
- Metas não são rateadas por produto ou canal: a medida retorna BLANK quando esses filtros estão ativos.
- Margem é lucro total dividido pela receita total. Ticket médio é receita dividida por pedidos distintos.
- Comparações anuais sem histórico retornam BLANK, nunca um crescimento fictício de 100%.
- Fonte incorporada: uma atualização recarrega a mesma amostra; para receber dados novos, substitua a consulta Fontes por uma fonte autorizada.

Veja o roteiro de operação e as fontes oficiais na pasta documentacao.
