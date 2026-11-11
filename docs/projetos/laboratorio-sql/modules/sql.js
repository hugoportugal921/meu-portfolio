const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const PRESETS=[
  {label:'Resumo por unidade',sql:`-- Consolidação com JOIN e agregações\nSELECT u.nome AS unidade,\n       COUNT(*) AS operacoes,\n       ROUND(SUM(o.valor), 2) AS valor_total,\n       ROUND(AVG(o.duracao_min), 1) AS duracao_media_min\nFROM operacoes o\nJOIN unidades u ON u.id = o.unidade_id\nGROUP BY u.id, u.nome\nORDER BY valor_total DESC;`},
  {label:'Ranking de categorias',sql:`-- CTE e função de janela para classificar categorias\nWITH totais AS (\n  SELECT c.nome AS categoria, COUNT(*) AS operacoes,\n         ROUND(SUM(o.valor), 2) AS valor_total\n  FROM operacoes o\n  JOIN categorias c ON c.id = o.categoria_id\n  GROUP BY c.id, c.nome\n)\nSELECT DENSE_RANK() OVER (ORDER BY valor_total DESC) AS posicao,\n       categoria, operacoes, valor_total\nFROM totais\nORDER BY posicao, categoria;`},
  {label:'Conclusão por unidade',sql:`-- Agregação condicional e cálculo de indicador\nSELECT u.nome AS unidade, COUNT(*) AS operacoes,\n       SUM(CASE WHEN o.status = 'Concluído' THEN 1 ELSE 0 END) AS concluidas,\n       ROUND(100.0 * SUM(CASE WHEN o.status = 'Concluído' THEN 1 ELSE 0 END)\n             / NULLIF(COUNT(*), 0), 1) AS conclusao_pct\nFROM operacoes o\nJOIN unidades u ON u.id = o.unidade_id\nGROUP BY u.id, u.nome\nORDER BY conclusao_pct DESC;`},
  {label:'Evolução acumulada',sql:`-- Série diária e soma acumulada com janela\nWITH diario AS (\n  SELECT data, COUNT(*) AS operacoes, SUM(valor) AS valor_dia\n  FROM operacoes\n  GROUP BY data\n)\nSELECT data, operacoes, ROUND(valor_dia, 2) AS valor_dia,\n       ROUND(SUM(valor_dia) OVER (\n         ORDER BY data ROWS UNBOUNDED PRECEDING\n       ), 2) AS valor_acumulado\nFROM diario\nORDER BY data;`}
];

export function resultToCSV(result) {
  const cell=value=>{
    let text=String(value??'');
    if(typeof value==='string' && /^[\s]*[=+@-]/.test(text))text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  };
  return '\uFEFF'+[result.columns,...result.values].map(row=>row.map(cell).join(';')).join('\r\n');
}

function downloadCSV(result) {
  const csv=resultToCSV(result);
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='consulta-sql.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function mount(container,store) {
  let worker=null,epoch=0,ready=false,busy=false,closed=false,timeout=null,requestId=0,pendingRun=true,lastResults=[];
  container.innerHTML=`
    <style>.sql-layout{display:grid;grid-template-columns:minmax(0,1fr) 265px;gap:20px;align-items:start}.sql-presets{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.sql-presets .button{font-size:12px;padding:9px 12px}.sql-presets .is-selected{color:var(--accent,#b8f370);border-color:var(--accent,#b8f370)}.sql-editor{display:block;width:100%;min-height:350px;resize:vertical;padding:20px!important;font:13px/1.75 ui-monospace,SFMono-Regular,Consolas,monospace!important;tab-size:2;box-sizing:border-box;white-space:pre;color:#dbe6ff!important;background:#101916!important;border:1px solid var(--border,#293830)!important;border-radius:12px;outline-offset:3px}.sql-actions{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:16px}.sql-schema h3{font-size:14px;margin:0 0 10px}.sql-schema ul{list-style:none;padding:0;margin:0 0 22px}.sql-schema li{display:flex;justify-content:space-between;gap:12px;margin:9px 0;font:11px/1.4 ui-monospace,Consolas,monospace}.sql-schema li span{color:var(--muted,#81908c)}.sql-schema .sql-relation{font-size:12px;line-height:1.7}.sql-result{margin-top:20px}.sql-result .table-wrap{max-height:480px;overflow:auto}.sql-query-status{font-size:12px}.sql-result h3{font-size:15px}.sql-query-error{white-space:pre-wrap;overflow-wrap:anywhere}.sql-editor:focus{outline:2px solid var(--accent,#b8f370)}@media(max-width:950px){.sql-layout{grid-template-columns:1fr}.sql-schema{display:grid;grid-template-columns:1fr 1fr;gap:15px}.sql-schema .sql-relation{grid-column:1/-1}}@media(max-width:540px){.sql-schema{display:block}.sql-editor{font-size:11px!important;padding:12px!important}}</style>
    <div class="page-intro"><span class="eyebrow">PROJETO 03 · ENGENHARIA DE DADOS</span><h1>Dados sob consulta<span class="accent-dot">.</span></h1><p class="muted">Uma base relacional real, consultas editáveis e resultados calculados com SQLite. Explore os exemplos ou escreva seu próprio SQL.</p></div>
    <div class="sql-layout"><div><section class="panel"><div class="panel-header"><div><span class="eyebrow">LABORATÓRIO SQL</span><h2 class="section-title">Da pergunta ao resultado</h2></div><span class="badge">SQLite · WebAssembly</span></div><div class="sql-presets">${PRESETS.map((preset,index)=>`<button type="button" class="button ghost ${index===0?'is-selected':''}" data-preset="${index}">${preset.label}</button>`).join('')}</div><label class="field"><span class="field-label">Consulta SQL <span class="muted">· Ctrl/⌘ + Enter para executar</span></span><textarea class="sql-editor" data-editor spellcheck="false" aria-label="Editor de consulta SQL">${escapeHTML(PRESETS[0].sql)}</textarea></label><div class="sql-actions"><button class="button primary" data-run type="button" disabled>Preparando banco…</button><span class="sql-query-status muted" data-status role="status">Carregando SQLite localmente.</span></div></section><div data-output aria-live="polite"></div></div>
    <aside class="panel sql-schema" aria-label="Esquema do banco de dados"><div><span class="eyebrow">MODELO RELACIONAL</span><h3>operacoes</h3><ul><li>id <span>TEXT · PK</span></li><li>data <span>TEXT</span></li><li>unidade_id <span>INTEGER · FK</span></li><li>categoria_id <span>INTEGER · FK</span></li><li>status <span>TEXT</span></li><li>valor <span>REAL</span></li><li>duracao_min <span>REAL</span></li></ul></div><div><h3>unidades</h3><ul><li>id <span>INTEGER · PK</span></li><li>nome <span>TEXT · UNIQUE</span></li></ul><h3>categorias</h3><ul><li>id <span>INTEGER · PK</span></li><li>nome <span>TEXT · UNIQUE</span></li></ul></div><p class="muted sql-relation">unidades 1 → N operacoes<br>categorias 1 → N operacoes<br><br><strong data-source-count></strong><br>Base de exemplo independente deste projeto. Reiniciada ao recarregar a página.</p></aside></div>
    <p class="notice">Consultas executadas de verdade no navegador, sem enviar dados a um servidor. Somente leitura; até 500 linhas por resultado, 5 resultados por execução e limite de 5 segundos para consultas. Os dados iniciais são fictícios.</p>`;
  const q=selector=>container.querySelector(selector),editor=q('[data-editor]'),run=q('[data-run]'),status=q('[data-status]'),output=q('[data-output]');
  function setBusy(value){busy=value;editor.disabled=value;for(const button of container.querySelectorAll('[data-preset]'))button.disabled=value;}
  function setStatus(message,error=false){status.textContent=message;status.classList.toggle('error',error);}
  function renderError(message){output.innerHTML=`<div class="panel sql-result"><h3>Não foi possível executar a consulta</h3><p class="error sql-query-error">${escapeHTML(message)}</p><p class="muted">Verifique os nomes das tabelas e colunas no modelo ao lado.</p></div>`;}
  function showResults(data) {
    lastResults=data.results;
    output.innerHTML=data.results.length ? data.results.map((result,index)=>`<section class="panel sql-result"><div class="panel-header"><h2 class="section-title">Resultado${data.results.length>1?' '+(index+1):''}</h2><button class="button ghost" type="button" data-export="${index}">Exportar CSV</button></div><p class="muted">${result.values.length} linha${result.values.length!==1?'s':''}${result.truncated?' · limite de 500 linhas atingido':''}</p><div class="table-wrap"><table><thead><tr>${result.columns.map(column=>`<th>${escapeHTML(column)}</th>`).join('')}</tr></thead><tbody>${result.values.length?result.values.map(row=>`<tr>${row.map(value=>`<td>${value===null?'<span class="muted">NULL</span>':escapeHTML(value)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${Math.max(1,result.columns.length)}" class="empty">Consulta concluída sem linhas.</td></tr>`}</tbody></table></div></section>`).join(''):'<div class="panel sql-result empty">A consulta não retornou uma tabela.</div>';
    for(const button of output.querySelectorAll('[data-export]'))button.addEventListener('click',()=>downloadCSV(lastResults[Number(button.dataset.export)]));
    setStatus(`Concluído em ${data.elapsed.toLocaleString('pt-BR',{maximumFractionDigits:1})} ms · ${data.results.reduce((sum,result)=>sum+result.values.length,0)} linhas`);
  }
  function execute() {
    if(closed||busy)return;
    if(!ready){startWorker(true);return;}
    setBusy(true);run.disabled=true;run.textContent='Executando…';setStatus('Processando consulta em segundo plano.');
    const id=++requestId;
    worker.postMessage({type:'query',id,sql:editor.value});
    clearTimeout(timeout);
    timeout=setTimeout(()=>{if(closed||id!==requestId)return;renderError('A consulta excedeu o limite de 5 segundos. Simplifique os cruzamentos ou restrinja os dados com WHERE.');startWorker(false);},5000);
  }
  function startWorker(autoRun=false) {
    clearTimeout(timeout);if(worker)worker.terminate();
    const currentEpoch=++epoch;ready=false;setBusy(false);pendingRun=autoRun;run.disabled=true;run.textContent='Preparando banco…';setStatus('Preparando tabelas e relacionamentos.');
    const rows=store.getRows();q('[data-source-count]').textContent=`${rows.length.toLocaleString('pt-BR')} operações na base`;
    worker=new Worker(new URL('./sql-worker.js',import.meta.url));
    worker.onmessage=({data})=>{
      if(closed||currentEpoch!==epoch)return;
      if(data.type==='ready'){clearTimeout(timeout);ready=true;run.disabled=false;run.textContent='Executar consulta';setStatus('Banco pronto · somente leitura');if(pendingRun){pendingRun=false;execute();}return;}
      if(data.id!==requestId)return;
      clearTimeout(timeout);setBusy(false);run.disabled=false;run.textContent=ready?'Executar consulta':'Tentar novamente';
      if(data.type==='error'){renderError(data.message);setStatus('Revise a consulta e tente novamente.',true);}else if(data.type==='result')showResults(data);
    };
    worker.onerror=()=>{if(closed||currentEpoch!==epoch)return;clearTimeout(timeout);ready=false;setBusy(false);run.disabled=false;run.textContent='Tentar novamente';setStatus('Não foi possível carregar o mecanismo SQL.',true);renderError('O mecanismo SQLite não carregou. Recarregue a página ou tente novamente.');};
    worker.postMessage({type:'init',id:++requestId,rows});
    timeout=setTimeout(()=>{if(closed||currentEpoch!==epoch||ready)return;worker.terminate();setBusy(false);run.disabled=false;run.textContent='Tentar novamente';setStatus('O banco demorou demais para carregar.',true);renderError('A preparação do mecanismo SQLite excedeu 15 segundos. Tente novamente ou reduza o tamanho da base importada.');},15000);
  }
  run.addEventListener('click',execute);
  editor.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();execute();}if(event.key==='Tab'){event.preventDefault();const start=editor.selectionStart;editor.setRangeText('  ',start,editor.selectionEnd,'end');}});
  for(const button of container.querySelectorAll('[data-preset]'))button.addEventListener('click',()=>{if(busy)return;editor.value=PRESETS[Number(button.dataset.preset)].sql;for(const sibling of container.querySelectorAll('[data-preset]'))sibling.classList.toggle('is-selected',sibling===button);if(ready)execute();else pendingRun=true;});
  const unsubscribe=store.subscribe(()=>startWorker(true));
  startWorker(true);
  return ()=>{closed=true;++epoch;clearTimeout(timeout);if(worker)worker.terminate();unsubscribe();};
}

