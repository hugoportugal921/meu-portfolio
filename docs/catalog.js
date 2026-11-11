const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function repositoryURL(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'github.com' && /^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname) && !url.username && !url.password && !url.search && !url.hash ? url.href : null; } catch { return null; }
}

function preview(type) {
  if (type === 'operations') return '<div class="project-preview preview-ops"><div class="mini-file"><span>CSV</span><i></i><i></i><i></i></div><div class="preview-connector">→</div><div class="mini-pipeline"><div><span class="mini-check">✓</span> Dados consolidados <b>360</b></div><div><span class="mini-check">✓</span> Relatório analítico <b>↗</b></div><small>AMOSTRA DEMONSTRATIVA</small></div></div>';
  if (type === 'dashboard') return `<div class="project-preview preview-dash"><div class="mini-chart-head"><span>VOLUME DE OPERAÇÕES</span><span class="mini-status">● AMOSTRA</span></div><svg viewBox="0 0 400 100" role="img" aria-label="Prévia ilustrativa de gráfico de barras"><path d="M10 85H390M10 50H390M10 15H390" stroke="#dbe3f1" stroke-dasharray="4 5"/>${[28,38,31,53,45,62,46,74,67,58,83,72,90,78,97].map((value,index)=>`<rect x="${12+index*25}" y="${100-value}" width="14" height="${value}" rx="3" fill="${index>11?'#244eed':'#a2b8fc'}"/>`).join('')}</svg></div>`;
  if (type === 'vision') return '<div class="project-preview preview-vision"><div class="vision-grid"></div><div class="vision-object"></div><div class="vision-box"><span>ÁREA RESTRITA</span><i></i></div><span class="vision-preview-label"><i></i> ANÁLISE DE QUADROS / CENA ILUSTRATIVA</span></div>';
  return '<div class="project-preview preview-sql"><div class="code-window-bar"><i></i><i></i><i></i><span>consulta.sql</span></div><code><span>SELECT</span> status, <em>COUNT</em>(*)<br><span>FROM</span> operacoes<br><span>GROUP BY</span> status;<br><small>-- Da pergunta ao resultado.</small></code><span class="sql-preview-badge">SQLite</span></div>';
}

export function renderProject(project, repositories) {
  const demos = project.demos ?? [{label:'Abrir demonstração',url:project.demoURL,repositoryKey:project.slug}];
  const sources = demos.map(item=>({url:repositoryURL(repositories?.[item.repositoryKey]),label:item.label})).filter(item=>item.url);
  const title = escapeHTML(project.title);
  const demo = escapeHTML(project.demoURL);
  const download = typeof project.downloadURL === 'string' && project.downloadURL.trim() ? escapeHTML(project.downloadURL) : null;
  const sourceLabel = project.repositoryVisibility === 'private' ? 'GitHub privado ↗' : 'GitHub ↗';
  const demoActions=demos.length>1?demos.map(item=>`<a class="button ghost" href="${escapeHTML(item.url)}">${escapeHTML(item.label)} ↗</a>`).join(''):'';
  const sourceActions=sources.map((item,index)=>`<a class="button ghost source-link" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">${sources.length>1?escapeHTML(index===0?'GitHub do dashboard ↗':'GitHub do SQL ↗'):sourceLabel}</a>`).join('');
  return `<article class="project-card${demos.length>1?' project-card--wide':''}" id="${escapeHTML(project.slug)}"><a href="${demo}" aria-label="Abrir demonstração: ${title}">${preview(project.preview)}</a><div class="project-body"><div class="project-kicker"><span>PROJETO ${escapeHTML(project.number)} / ${escapeHTML(project.category)}</span><span class="project-arrow" aria-hidden="true">↗</span></div><h3>${title}</h3><p class="project-scope"><span class="scope-label">ESCOPO DO PROJETO</span>${escapeHTML(project.description)}</p><div class="tag-list">${project.tags.map(tag=>`<span>${escapeHTML(tag)}</span>`).join('')}</div>${project.demoNote?`<p class="project-demo-note">${escapeHTML(project.demoNote)}</p>`:''}<div class="project-actions"><a class="button primary" href="${demo}">Ver projeto ↗</a>${demoActions}${download?`<a class="button ghost" href="${download}" download>Baixar código ↓</a>`:''}${sourceActions}</div></div></article>`;
}
