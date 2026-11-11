const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = value => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL',maximumFractionDigits:0}).format(value);
const number = value => new Intl.NumberFormat('pt-BR', {maximumFractionDigits:1}).format(value);

export function summarize(rows) {
  return {
    count: rows.length,
    total: rows.reduce((sum,row)=>sum + Number(row.amount || 0),0),
    complete: rows.length ? rows.filter(row=>row.status === 'Concluído').length / rows.length * 100 : 0,
    duration: rows.length ? rows.reduce((sum,row)=>sum + Number(row.duration || 0),0) / rows.length : 0,
  };
}

export function filterRows(rows, {unit='',status='',days='all'}={}) {
  const latest = rows.reduce((max,row)=>row.date > max ? row.date : max, '');
  let cutoff = '';
  if (days !== 'all' && latest) {
    const date = new Date(latest+'T12:00:00Z');
    date.setUTCDate(date.getUTCDate()-Number(days)+1);
    cutoff = date.toISOString().slice(0,10);
  }
  return rows.filter(row=>(!unit || row.unit===unit) && (!status || row.status===status) && (!cutoff || row.date>=cutoff));
}

function volumeChart(rows) {
  const groups = new Map();
  for (const row of rows) groups.set(row.date,(groups.get(row.date)||0)+1);
  const entries = [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).slice(-30);
  if (!entries.length) return '<div class="empty">Nenhuma operação corresponde aos filtros.</div>';
  const width=760,height=240,left=36,top=18,bottom=42,plotHeight=height-top-bottom,max=Math.max(...entries.map(([,n])=>n),1);
  const span=(width-left-18)/entries.length;
  const bars=entries.map(([date,value],i)=>{
    const x=left+i*span+span*.18,y=top+plotHeight-value/max*plotHeight,barWidth=Math.max(2,span*.64);
    const label=(i===0||i===entries.length-1||i%Math.max(1,Math.ceil(entries.length/6))===0) ? `<text x="${x+barWidth/2}" y="${height-14}" text-anchor="middle">${date.slice(8,10)}/${date.slice(5,7)}</text>`:'';
    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${value/max*plotHeight}" rx="${Math.min(5,barWidth/2)}" fill="var(--accent,#b8f370)" opacity="${.5+.5*value/max}"><title>${escapeHTML(date)}: ${value} operações</title></rect>${label}`;
  }).join('');
  const grid=[0,.5,1].map(f=>`<line x1="${left}" x2="${width-12}" y1="${top+plotHeight*(1-f)}" y2="${top+plotHeight*(1-f)}" stroke="currentColor" opacity=".12"/><text x="${left-8}" y="${top+plotHeight*(1-f)+4}" text-anchor="end">${Math.round(max*f)}</text>`).join('');
  return `<svg class="dash-volume" viewBox="0 0 ${width} ${height}" role="img" aria-label="Volume de operações por dia. ${entries.length} dias com registros; ${rows.length} operações no filtro.">${grid}${bars}</svg>`;
}

export function mount(container,store) {
  let running=false,ticker=null,closed=false;
  const filters={unit:'',status:'',days:'all'};
  container.innerHTML=`
    <style>
      .dashboard-controls{display:flex;gap:14px;align-items:end;flex-wrap:wrap}.dashboard-controls .field{min-width:150px;flex:1}.dashboard-controls .button{white-space:nowrap}.dash-volume{display:block;width:100%;min-height:180px;color:var(--muted,#81908c)}.dash-volume text{font:11px system-ui;fill:currentColor}.dashboard-bars{display:grid;gap:19px;padding:10px 0}.dashboard-bar-label{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;font-size:13px}.dashboard-track{height:9px;border-radius:20px;background:rgba(128,145,130,.12);overflow:hidden}.dashboard-fill{height:100%;border-radius:20px;background:var(--accent,#b8f370)}.dashboard-chart-grid{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(240px,1fr);gap:20px}.dash-note{margin-top:12px;font-size:12px}.dashboard-table td:last-child{white-space:nowrap}.dash-live{display:inline-flex;align-items:center;gap:7px}.dash-live::before{content:'';height:7px;width:7px;border-radius:50%;background:var(--muted,#81908c)}.dash-live.on::before{background:var(--accent,#b8f370);box-shadow:0 0 12px #b8f354}@media(max-width:850px){.dashboard-chart-grid{grid-template-columns:1fr}}
    </style>
    <div class="page-intro"><span class="eyebrow">PROJETO 03 · BUSINESS INTELLIGENCE</span><h1>Pulso da operação<span class="accent-dot">.</span></h1><p class="muted">Explore indicadores calculados sobre a base deste projeto. Cada filtro atualiza os números, os gráficos e os registros.</p></div>
    <div class="panel dashboard-controls">
      <label class="field"><span class="field-label">Unidade</span><select data-filter="unit" aria-label="Filtrar por unidade"></select></label>
      <label class="field"><span class="field-label">Período</span><select data-filter="days" aria-label="Filtrar por período"><option value="all">Todo o período</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></label>
      <label class="field"><span class="field-label">Status</span><select data-filter="status" aria-label="Filtrar por status"><option value="">Todos os status</option><option>Concluído</option><option>Em andamento</option><option>Pendente</option></select></label>
      <button class="button primary" data-live type="button">Iniciar atualização</button>
    </div>
    <div class="status-line"><span data-live-label class="dash-live">Atualização simulada pausada</span><span data-updated></span></div>
    <div class="metric-grid" data-metrics></div>
    <div class="dashboard-chart-grid"><section class="panel"><div class="panel-header"><div><span class="eyebrow">EVOLUÇÃO</span><h2 class="section-title">Volume por dia</h2></div><span class="badge">Até 30 datas</span></div><div data-volume></div><p class="muted dash-note">O período usa como referência a data mais recente da base.</p></section><section class="panel"><div class="panel-header"><div><span class="eyebrow">DISTRIBUIÇÃO</span><h2 class="section-title">Operações por unidade</h2></div></div><div class="dashboard-bars" data-units></div></section></div>
    <section class="panel"><div class="panel-header"><div><span class="eyebrow">DADOS EM DETALHE</span><h2 class="section-title">Atividade recente</h2></div><span class="badge" data-row-count></span></div><div class="table-wrap"><table class="dashboard-table"><thead><tr><th>ID</th><th>Data</th><th>Unidade</th><th>Categoria</th><th>Status</th><th>Valor</th></tr></thead><tbody data-rows></tbody></table></div></section>
    <p class="notice">Ambiente demonstrativo. A atualização automática adiciona uma operação fictícia a cada 4 segundos à base deste projeto; ela não representa uma conexão com sistemas de produção.</p>`;
  const q=selector=>container.querySelector(selector);
  const unitsSelect=q('[data-filter="unit"]');
  function render() {
    if(closed)return;
    const all=store.getRows(), units=[...new Set(all.map(row=>row.unit))].sort();
    if(filters.unit&&!units.includes(filters.unit))filters.unit='';
    unitsSelect.innerHTML='<option value="">Todas as unidades</option>'+units.map(unit=>`<option value="${escapeHTML(unit)}" ${unit===filters.unit?'selected':''}>${escapeHTML(unit)}</option>`).join('');
    const rows=filterRows(all,filters),stats=summarize(rows);
    q('[data-metrics]').innerHTML=[['Operações',number(stats.count),'registros no período'],['Valor movimentado',money(stats.total),'soma dos valores da base'],['Taxa de conclusão',number(stats.complete)+'%','operações concluídas'],['Duração média',number(stats.duration)+' min','média de todos os registros']].map(([label,value,note])=>`<article class="metric"><span class="metric-label">${label}</span><strong class="metric-value">${value}</strong><span class="muted">${note}</span></article>`).join('');
    q('[data-volume]').innerHTML=volumeChart(rows);
    const counts=new Map();for(const row of rows)counts.set(row.unit,(counts.get(row.unit)||0)+1);
    const ordered=[...counts.entries()].sort((a,b)=>b[1]-a[1]);const max=Math.max(...ordered.map(([,n])=>n),1);
    q('[data-units]').innerHTML=ordered.length?ordered.map(([unit,count])=>`<div><div class="dashboard-bar-label"><span>${escapeHTML(unit)}</span><strong>${number(count)}</strong></div><div class="dashboard-track"><div class="dashboard-fill" style="width:${count/max*100}%"></div></div></div>`).join(''):'<p class="empty">Nenhum registro neste filtro.</p>';
    const recent=[...rows].reverse().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
    q('[data-rows]').innerHTML=recent.length?recent.map(row=>`<tr><td>${escapeHTML(row.id)}</td><td>${escapeHTML(row.date.split('-').reverse().join('/'))}</td><td>${escapeHTML(row.unit)}</td><td>${escapeHTML(row.category)}</td><td><span class="badge">${escapeHTML(row.status)}</span></td><td>${money(row.amount)}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">Nenhuma operação corresponde aos filtros.</td></tr>';
    q('[data-row-count]').textContent=`${recent.length} de ${number(rows.length)} registros`;
    q('[data-updated]').textContent='Atualizado às '+new Date().toLocaleTimeString('pt-BR');
  }
  function tick() {
    const all=store.getRows(), base=all[Math.floor(Math.random()*all.length)]||{unit:'São Paulo',category:'Operação',amount:100,duration:30};
    store.appendRows([{id:`DEMO-${Date.now()}-${Math.floor(Math.random()*1000)}`,date:new Date().toISOString().slice(0,10),unit:base.unit,category:base.category,status:['Concluído','Em andamento','Pendente'][Math.floor(Math.random()*3)],amount:Math.round((Number(base.amount)||100)*(.7+Math.random()*.6)*100)/100,duration:Math.round(10+Math.random()*110)}]);
  }
  for(const select of container.querySelectorAll('[data-filter]'))select.addEventListener('change',()=>{filters[select.dataset.filter]=select.value;render();});
  q('[data-live]').addEventListener('click',()=>{running=!running;if(running)ticker=setInterval(tick,4000);else{clearInterval(ticker);ticker=null;}q('[data-live]').textContent=running?'Pausar atualização':'Iniciar atualização';q('[data-live-label]').textContent=running?'Atualização simulada a cada 4 s':'Atualização simulada pausada';q('[data-live-label]').classList.toggle('on',running);});
  const unsubscribe=store.subscribe(render);render();
  return ()=>{closed=true;clearInterval(ticker);unsubscribe();};
}

