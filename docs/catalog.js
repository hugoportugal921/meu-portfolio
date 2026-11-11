const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function repositoryURL(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && /^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname) && !url.username && !url.password && !url.search && !url.hash ? url.href : null;
  } catch { return null; }
}

function preview(type) {
  if (type === 'operations') return `<div class="project-preview visual-automation" role="img" aria-label="Esquema ilustrativo de importação, validação e geração de relatórios">
    <span class="visual-label">ARQUITETURA DE AUTOMAÇÃO</span>
    <div class="pipeline-node"><b>CSV</b><span><strong>Fontes de dados</strong><small>Entrada e organização dos registros</small></span></div>
    <i class="pipeline-connector" aria-hidden="true"></i>
    <div class="pipeline-node"><b>✓</b><span><strong>Validação e consolidação</strong><small>Regras, consistência e cruzamentos</small></span></div>
    <i class="pipeline-connector" aria-hidden="true"></i>
    <div class="pipeline-node"><b>↗</b><span><strong>Relatórios analíticos</strong><small>Processamento em segundo plano</small></span></div>
    <span class="visual-caption">DADOS → PROCESSAMENTO → INFORMAÇÃO</span><span class="visual-concept">ESQUEMA ILUSTRATIVO</span>
  </div>`;
  if (type === 'vision') return `<div class="project-preview visual-vision" role="img" aria-label="Esquema ilustrativo de monitoramento de uma região de interesse e captura de eventos">
    <span class="visual-label">MONITORAMENTO DE CONFORMIDADE</span>
    <div class="monitor-frame"><div class="monitor-roi"><span></span></div><span class="monitor-caption">REGIÃO DE INTERESSE</span></div>
    <div class="event-line"><i aria-hidden="true"></i>Captura · Análise · Registro de eventos</div>
    <span class="visual-caption">IMAGENS → REGRAS → EVENTOS</span><span class="visual-concept">ESQUEMA ILUSTRATIVO</span>
  </div>`;
  return `<div class="project-preview visual-data" role="img" aria-label="Esquema ilustrativo de consultas SQL e visualização de indicadores">
    <span class="visual-label">ESTRUTURA E INTELIGÊNCIA DE DADOS</span>
    <div class="query-preview"><small>ANÁLISE POR UNIDADE</small><code><span>SELECT</span> unidade,<br>&nbsp;&nbsp;<span>COUNT</span>(*) AS volume<br><span>FROM</span> operacoes<br><span>GROUP BY</span> unidade;</code></div>
    <div class="data-bars" aria-hidden="true">${[34,48,39,63,55,79,68,92].map(height=>`<i style="height:${height}%"></i>`).join('')}</div>
    <span class="visual-caption">MODELAGEM → CONSULTAS → INDICADORES</span><span class="visual-concept">ESQUEMA ILUSTRATIVO</span>
  </div>`;
}

export function renderProject(project, repositories) {
  const demos = project.demos ?? [{label:'Abrir demonstração',url:project.demoURL,repositoryKey:project.slug}];
  const sources = demos.map(item=>({url:repositoryURL(repositories?.[item.repositoryKey]),repositoryKey:item.repositoryKey})).filter(item=>item.url);
  const title = escapeHTML(project.title);
  const demo = escapeHTML(project.demoURL);
  const download = typeof project.downloadURL === 'string' && project.downloadURL.trim() ? escapeHTML(project.downloadURL) : null;
  const sourceLabel = project.repositoryVisibility === 'private' ? 'GitHub privado ↗' : 'GitHub ↗';
  const demoActions = demos.length>1 ? demos.map(item=>`<a class="button ghost" href="${escapeHTML(item.url)}">${escapeHTML(item.label)} ↗</a>`).join('') : '';
  const sourceActions = sources.map(item=>`<a class="source-link" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">${sources.length>1?(item.repositoryKey==='laboratorio-sql'?'SQL · ':'Dashboard · '):''}${sourceLabel}</a>`).join('');
  return `<article class="project-card${demos.length>1?' project-card--wide':''}" id="${escapeHTML(project.slug)}" aria-labelledby="${escapeHTML(project.slug)}-title">
    <div class="project-visual project-visual--${escapeHTML(project.preview)}">${preview(project.preview)}</div>
    <div class="project-body"><div class="project-kicker"><span>PROJETO ${escapeHTML(project.number)} / ${escapeHTML(project.category)}</span><span class="project-arrow" aria-hidden="true">↗</span></div>
      <h3 id="${escapeHTML(project.slug)}-title">${title}</h3>
      <p class="project-scope"><span class="scope-label">ESCOPO DO PROJETO</span>${escapeHTML(project.description)}</p>
      <div class="tag-list">${project.tags.map(tag=>`<span>${escapeHTML(tag)}</span>`).join('')}</div>
      <div class="project-actions"><a class="button primary" href="${demo}">Ver projeto ↗</a>${demoActions}${download?`<a class="button ghost" href="${download}" download>Baixar código ↓</a>`:''}</div>
      ${sourceActions?`<div class="project-sources">${sourceActions}</div>`:''}
      ${project.demoNote?`<details class="demo-disclosure"><summary>Sobre a demonstração disponível</summary><p>${escapeHTML(project.demoNote)}</p></details>`:''}
    </div>
  </article>`;
}
