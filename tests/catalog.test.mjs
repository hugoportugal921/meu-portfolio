import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { renderProject, repositoryURL } from '../docs/catalog.js';
const root=new URL('../docs/',import.meta.url);
const projects=JSON.parse(await readFile(new URL('projects.json',root),'utf8'));
const repositories=JSON.parse(await readFile(new URL('repositories.json',root),'utf8'));

test('três projetos agrupam as quatro demonstrações e seus repositórios privados',()=>{
  assert.equal(projects.length,3);
  assert.equal(new Set(projects.map(project=>project.slug)).size,3);
  assert.equal(new Set(projects.map(project=>project.demoURL)).size,3);
  assert.deepEqual(projects.map(project=>project.number),['01','02','03']);
  assert.deepEqual(projects.map(project=>project.slug),['consolidacao-dados','video-analitico','ecossistema-dados']);
  const demos=projects.flatMap(project=>project.demos);
  assert.equal(demos.length,4);
  assert.deepEqual(Object.keys(repositories).sort(),demos.map(demo=>demo.repositoryKey).sort());
  assert.equal(new Set(demos.map(demo=>demo.url)).size,4);
  for(const project of projects){
    assert.match(project.slug,/^[a-z][a-z-]+$/);
    assert.equal(new URL(project.demoURL,'https://hugoportugal921.github.io/meu-portfolio/').protocol,'https:');
    assert.ok(project.downloadURL === null || project.downloadURL === `./downloads/${project.slug}.zip`);
    assert.equal(project.repositoryVisibility,'private');
    assert.equal(project.downloadURL,null);
    assert.ok(project.description.length>30);
    assert.ok(project.tags.length>=2);
  }
});

test('GitHub só é apresentado quando há um endereço de repositório válido',()=>{
  const project=projects[0];
  assert.doesNotMatch(renderProject(project,{[project.slug]:null}),/source-link/);
  assert.doesNotMatch(renderProject(project,{[project.slug]:'javascript:alert(1)'}),/source-link/);
  assert.doesNotMatch(renderProject(project,{[project.slug]:'https://github.com/hugoportugal921'}),/source-link/);
  const html=renderProject(project,{[project.slug]:'https://github.com/hugoportugal921/consolidacao-dados'});
  assert.match(html,/source-link/);
  assert.match(html,/GitHub privado ↗/);
  assert.doesNotMatch(renderProject({...project,repositoryVisibility:'public'},{[project.slug]:'https://github.com/hugoportugal921/consolidacao-dados'}),/GitHub privado/);
  assert.match(html,/https:\/\/github\.com\/hugoportugal921\/consolidacao-dados/);
  assert.equal(repositoryURL('https://example.com/user/repo'),null);
});

test('cartões contêm ações distintas e escapam textos de configuração',()=>{
  const html=renderProject({...projects[0],title:'<script>alert(1)</script>',description:'"exemplo" & análise'},{});
  assert.match(html,/Ver projeto/);
  assert.doesNotMatch(html,/Baixar código|\sdownload(?:[\s>])/);
  assert.match(renderProject({...projects[0],downloadURL:'./downloads/consolidacao-dados.zip'},{}),/href="\.\/downloads\/consolidacao-dados\.zip" download>Baixar código/);
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/&quot;exemplo&quot; &amp; análise/);
});

test('catálogo anterior preserva os três projetos e seus arquivos locais',async()=>{
  const html=await readFile(new URL('catalogo-anterior.html',root),'utf8');
  for(const [,filename]of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g))await access(new URL(filename,root));
  for(const project of projects)assert.ok(html.includes(project.demoURL));
  assert.doesNotMatch(html,/base compartilhada|dados compartilhados|#operacoes|#dashboard|#visao|#sql/);
  await access(new URL('navigation.js',root));
  await access(new URL('.nojekyll',root));
  assert.match(html,/3 projetos/);
  assert.match(html,/01 — 03/);
  assert.doesNotMatch(html,/Quatro soluções|4 projetos/);
});

test('ecossistema mantém dashboard e SQL acessíveis pelo cartão e pelo perfil',async()=>{
  const project=projects[2], html=renderProject(project,repositories);
  assert.match(html,/Ver projeto/);
  for(const demo of project.demos){assert.ok(html.includes(`href="${demo.url}"`));assert.ok(html.includes(repositories[demo.repositoryKey]));}
  const page=await readFile(new URL('ecossistema.html',root),'utf8');
  const profile=await readFile(new URL('perfil.html',root),'utf8');
  for(const demo of project.demos){assert.ok(page.includes(`href="${demo.url}"`));assert.ok(profile.includes(`href="${demo.url}"`));}
  for(const item of projects)assert.ok(profile.includes(item.title));
  assert.equal((profile.match(/<article class="competency/g)||[]).length,3);
});

test('todas as fontes locais declaradas pelo CSS estão presentes',async()=>{
  const css=await readFile(new URL('styles.css',root),'utf8');
  const fonts=[...css.matchAll(/url\('\.\/([^']+)'\)/g)];
  assert.ok(fonts.length>0);
  for(const [,filename]of fonts)await access(new URL(filename,root));
});
