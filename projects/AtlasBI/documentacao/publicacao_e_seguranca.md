# Publicação, acesso e atualização

## Validação antes de publicar

1. Atualize o modelo no Desktop e confronte cada unidade com valores_controle.json.
2. Confira as segmentações e o cruzamento entre gráficos. Na página de produtos, a meta deve ficar indisponível quando há filtro de categoria ou canal.
3. Em Exibir como função, teste AcessoPorUnidade com analista.sp@example.com (apenas São Paulo), analista.recife@example.com (apenas Recife), gestao@example.com (todas as unidades) e uma identidade desconhecida (nenhuma unidade).
4. Troque as identidades de exemplo por identidades autorizadas no mapeamento AcessoUnidade antes de qualquer uso real.

## Publicar no Power BI Service

1. Entre com a conta Microsoft autorizada, escolha um workspace de destino e publique o projeto validado.
2. Atribua os usuários à função AcessoPorUnidade no modelo semântico e teste os resultados no serviço.
3. Disponibilize a consumidores como Visualizadores. RLS não restringe usuários com permissões de edição de workspace (Administrador, Membro ou Colaborador).
4. Revise licenças/capacidade para a forma de compartilhamento pretendida. Nenhuma licença é fornecida por este projeto.
5. Para uma fonte de produção, substitua a amostra por dados autorizados e configure a conexão, credenciais e, quando a fonte exigir, gateway.
6. Configure a agenda de atualização conforme a licença e a disponibilidade da fonte. Revise histórico, falhas e notificação ao responsável.
7. Valide o aplicativo, os grupos autorizados e a experiência móvel antes da distribuição.

## Limites do projeto

RLS definida em arquivos não comprova sua aplicação no serviço. O filtro de unidade da prévia web é um recurso analítico e não é um controle de segurança. A amostra incorporada permite estudar o fluxo sem conectar dados empresariais. Nenhuma implantação no tenant Microsoft é declarada como concluída.

## Fontes oficiais

- https://learn.microsoft.com/power-bi/developer/projects/projects-overview
- https://learn.microsoft.com/power-bi/developer/projects/projects-dataset
- https://learn.microsoft.com/power-bi/developer/projects/projects-report
- https://learn.microsoft.com/power-bi/guidance/star-schema
- https://learn.microsoft.com/fabric/security/service-admin-row-level-security
- https://learn.microsoft.com/power-bi/connect-data/refresh-scheduled-refresh
