# Eng. Hugo Portugal — Portfólio profissional

[Acessar o portfólio](https://hugoportugal921.github.io/meu-portfolio/)

Apresentação de Hugo Portugal Vasconcelos, engenheiro metalúrgico com especialização em Engenharia de Software e Sistemas.

## Organização em três projetos

1. Plataforma de Automação Operacional e Relatórios Assíncronos.
2. Sistema de Visão Computacional para Monitoramento de Conformidade.
3. Ecossistema de Dados e Monitoramento Gerencial em Tempo Real — reúne dashboard e SQL na página ecossistema.html.

As descrições apresentam o escopo dos projetos; cada cartão identifica o que pode ser testado nas demonstrações estáticas. São três projetos apresentados e quatro demonstrações preservadas.

## Páginas e demonstrações

- Perfil profissional: perfil.html
- Consolidação de dados: projetos/consolidacao-dados/
- Dashboard operacional: projetos/dashboard-operacional/
- Vídeo analítico: projetos/video-analitico/
- Laboratório SQL: projetos/laboratorio-sql/

A apresentação e as quatro demonstrações funcionam no mesmo endereço do GitHub Pages, sem autenticação. O site publica os arquivos estáticos (HTML, CSS, JavaScript, fontes e WebAssembly) necessários à execução no navegador. Os quatro repositórios originais dos projetos permanecem privados.

## Executar localmente

Requer Node.js 20 ou mais recente. Não há dependências a instalar.

```sh
node serve.mjs
node --test
```

Abra http://127.0.0.1:4173. No Windows, iniciar.cmd também inicia o servidor.

## Publicação

GitHub Pages serve docs da branch main. Todos os links da aplicação são relativos e compatíveis com /meu-portfolio/. Os links externos de código apontam para GitHub. docs/.nojekyll desativa processamento Jekyll.

## Dados e recursos

As demonstrações usam dados fictícios e processam os dados localmente. Relatórios e SQLite são executados em Workers. O vídeo analítico compara quadros; a cena de exemplo funciona sem câmera. Usar câmera depende da permissão do visitante para o domínio atual.

## Créditos

Fontes DM Sans e Manrope: licenças OFL incluídas em fonts/. O laboratório SQL inclui sql.js e sua licença no diretório vendor/.
