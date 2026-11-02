import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat, access } from 'node:fs/promises';

const root = new URL('../docs/', import.meta.url);
const publicRoot = new URL('https://hugoportugal921.github.io/meu-portfolio/');
async function files(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await files(new URL(entry.name + '/', directory), path + '/'));
    else result.push(path);
  }
  return result;
}

test('links e recursos locais permanecem no subdiretório publicado e existem no pacote', async () => {
  for (const path of await files(root)) {
    if (!/\.(html|css|js|json)$/.test(path)) continue;
    const content = await readFile(new URL(path, root), 'utf8');
    assert.doesNotMatch(content, /chatgpt(?:-team)?\.site/i, path);
    const expressions = path.endsWith('.html')
      ? [/(?:src|href)="(\.{1,2}\/[^"#]+)(?:#[^"]*)?"/g]
      : path.endsWith('.css') ? [/url\(['"]?(\.{1,2}\/[^'"\)]+)['"]?\)/g]
      : [/(?:from\s+|import\(\s*|importScripts\(\s*|new URL\(\s*)['"](\.{1,2}\/[^'"]+)['"](?=\s*[,;)])/g];
    for (const expression of expressions) for (const match of content.matchAll(expression)) {
      const resolved = new URL(match[1], new URL(path, publicRoot));
      assert.equal(resolved.origin, publicRoot.origin, path);
      assert.ok(resolved.pathname.startsWith(publicRoot.pathname), `${path}: ${match[1]}`);
      let local = new URL(resolved.pathname.slice(publicRoot.pathname.length), root);
      if ((await stat(local)).isDirectory()) local = new URL('index.html', local.href.replace(/\/?$/, '/'));
      await access(local);
    }
  }
});

test('as quatro demonstrações retornam ao portfólio e preservam os recursos dos Workers', async () => {
  const projects = JSON.parse(await readFile(new URL('projects.json', root), 'utf8'));
  for (const project of projects) {
    const demo = new URL(project.demoURL, publicRoot);
    const directory = new URL(`projetos/${project.slug}/`, root);
    const config = (await import(new URL('project-config.js', directory))).default;
    assert.equal(new URL(config.portfolioURL, demo).href, publicRoot.href);
    await access(new URL(config.moduleURL, directory));
    await access(new URL('index.html', directory));
  }
  for (const path of ['projetos/consolidacao-dados/modules/report-worker.js', 'projetos/laboratorio-sql/modules/sql-worker.js', 'projetos/laboratorio-sql/vendor/sql-wasm.js', 'projetos/laboratorio-sql/vendor/sql-wasm.wasm']) await access(new URL(path, root));
});
