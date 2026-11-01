# Eng. Hugo Portugal — Portfólio profissional

Apresentação de Hugo Portugal Vasconcelos, engenheiro metalúrgico com especialização em Engenharia de Software e Sistemas, com foco em indústria, planejamento, qualidade, tecnologia e inteligência de dados.

[Acessar o portfólio](https://hugoportugal921.github.io/meu-portfolio/)

## Conteúdo

- Página inicial com apresentação profissional e catálogo de quatro projetos.
- Página de perfil com formação, experiência, competências e abordagem de trabalho.
- Links para demonstrações independentes e repositórios privados dos projetos.

Este repositório contém somente o site de apresentação. Os quatro projetos continuam em repositórios privados separados. As demonstrações são hospedadas separadamente e o catálogo não oferece pacotes públicos do código dos projetos.

## Executar localmente

Requer Node.js 20 ou mais recente. Não há pacotes a instalar.

```sh
node serve.mjs
```

Abra http://127.0.0.1:4173. No Windows, também é possível abrir iniciar.cmd.

## Publicação

O GitHub Pages serve a pasta docs da branch main. Os arquivos usam caminhos relativos para funcionar em /meu-portfolio/. A pasta docs inclui .nojekyll.

## Atualizar o conteúdo

- docs/index.html: apresentação inicial e ordem do menu.
- docs/perfil.html: perfil profissional.
- docs/projects.json: cartões e endereços das demonstrações.
- docs/repositories.json: links dos repositórios dos projetos.
- docs/profile.css e docs/catalog.css: estilos da apresentação.

## Verificações

```sh
node --test
```

## Créditos

Fontes DM Sans e Manrope distribuídas sob suas licenças OFL, incluídas em docs/fonts/. Os dados das demonstrações são fictícios.
