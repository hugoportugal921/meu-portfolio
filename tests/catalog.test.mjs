import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { renderProject, repositoryURL } from '../docs/catalog.js';
const root=new URL('../docs/',import.meta.url);
const projects=JSON.parse(await readFile(new URL('projects.json',root),'utf8'));
const repositories=JSON.parse(await readFile(new URL('repositories.json',root),'utf8'));

test('catálogo contém os quatro projetos independentes com destinos e downloads opcionais',()=>{
  assert.equal(projects.length,4);
  assert.equal(new Set(projects.map(project=>project.slug)).size,4);
  assert.equal(new Set(projects.map(project=>project.demoURL)).size,4);
  assert.deepEqual(Object.keys(repositories).sort(),projects.map(project=>project.slug).sort());
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

test('HTML referencia somente arquivos locais presentes e quatro demonstrações independentes',async()=>{
  const html=await readFile(new URL('index.html',root),'utf8');
  for(const [,filename]of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g))await access(new URL(filename,root));
  for(const project of projects)assert.ok(html.includes(project.demoURL));
  assert.doesNotMatch(html,/base compartilhada|dados compartilhados|#operacoes|#dashboard|#visao|#sql/);
  await access(new URL('navigation.js',root));
  await access(new URL('.nojekyll',root));
});

test('todas as fontes locais declaradas pelo CSS estão presentes',async()=>{
  const css=await readFile(new URL('styles.css',root),'utf8');
  const fonts=[...css.matchAll(/url\('\.\/([^']+)'\)/g)];
  assert.ok(fonts.length>0);
  for(const [,filename]of fonts)await access(new URL(filename,root));
});
