'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean = value => String(value ?? '').trim();
  const norm = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const today = () => {const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const dateText = value => value ? value.slice(8,10)+'/'+value.slice(5,7)+'/'+value.slice(0,4) : '—';
  const storageKey = 'hugo_gestao_indicadores_v1';
  const seed = {
    tasks: clone(window.GESTAO_SEED || []),
    ncs: [
      {id:101,titulo:'Checklist semanal não preenchido',area:'Operações',criticidade:'Média',what:'Atualizar o checklist e realizar conferência',why:'Garantir rastreabilidade da rotina',where:'Unidade A',when:'2026-11-28',who:'Equipe de operações',how:'Revisar a lista e registrar a inspeção',howmuch:'Sem custo adicional',status:'Aberta'},
      {id:102,titulo:'Relatório com valores duplicados',area:'Qualidade',criticidade:'Alta',what:'Revisar a consolidação dos dados',why:'Evitar contagem duplicada',where:'Base de indicadores',when:'2026-11-24',who:'Equipe de qualidade',how:'Validar identificadores e reconciliar a base',howmuch:'2 horas de trabalho',status:'Aberta'},
      {id:103,titulo:'Meta sem responsável definido',area:'Planejamento',criticidade:'Baixa',what:'Definir responsável pela meta',why:'Garantir acompanhamento periódico',where:'Painel gerencial',when:'2026-11-18',who:'Equipe de planejamento',how:'Registrar atribuição na rotina de acompanhamento',howmuch:'Sem custo adicional',status:'Concluída'}
    ]
  };
  let state;
  try { state=JSON.parse(localStorage.getItem(storageKey)); } catch { state=null; }
  if (!state || !Array.isArray(state.tasks) || !Array.isArray(state.ncs)) state=clone(seed);
  const save = () => { try{localStorage.setItem(storageKey,JSON.stringify(state));return true}catch{return false} };
  let report = null;

  function stat(label,value,note){return '<div class="stat"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><span>'+esc(note)+'</span></div>'}
  function tag(text,late=false){const cls=late?'late':text==='Concluída'?'done':'';return '<span class="tag '+cls+'">'+esc(text)+'</span>'}
  function feedback(id,message,error=false){const el=$(id);el.textContent=message;el.classList.toggle('error',error)}
  function showView(){
    const valid=['processos','relatorios','qualidade'];
    const view=valid.includes(location.hash.slice(1))?location.hash.slice(1):'processos';
    document.querySelectorAll('[data-view]').forEach(el=>el.hidden=el.dataset.view!==view);
    document.querySelectorAll('[data-tab]').forEach(el=>{if(el.dataset.tab===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
    if(view==='processos')renderTasks();
    if(view==='qualidade')renderNCs();
    if(view==='relatorios')renderReport();
  }
  function overdue(item){return item.situacao!=='Concluída' && !!item.prazo && item.prazo<today()}
  function renderTasks(){
    const all=state.tasks, completed=all.filter(x=>x.situacao==='Concluída'&&x.conclusao&&x.prazo), timely=completed.filter(x=>x.conclusao<=x.prazo);
    $('taskStats').innerHTML=stat('Atividades',all.length,'no exemplo local')+stat('Em aberto',all.filter(x=>x.situacao!=='Concluída').length,'não concluídas')+stat('Atrasadas',all.filter(overdue).length,'abertas e vencidas')+stat('Concluídas no prazo',completed.length?Math.round(timely.length/completed.length*100)+'%':'—','entre concluídas com datas');
    const filter=$('taskFilter').value, rows=all.filter(x=>filter==='Todas'||x.situacao===filter);
    $('taskCount').textContent=rows.length+' de '+all.length+' atividades exibidas.';
    $('taskTable').innerHTML=rows.map(x=>'<tr><td>'+esc(x.atividade)+'</td><td>'+esc(x.area)+'</td><td>'+esc(x.responsavel)+'</td><td>'+dateText(x.prazo)+'</td><td>'+tag(overdue(x)?'Atrasada':x.situacao,overdue(x))+'</td><td><button type="button" class="table-button" data-task="'+esc(x.id)+'">'+(x.situacao==='Concluída'?'Reabrir':'Concluir')+'</button></td></tr>').join('')||'<tr><td class="empty" colspan="6">Nenhuma atividade para este filtro.</td></tr>';
  }
  function renderNCs(){
    const ncs=state.ncs, open=ncs.filter(x=>x.status!=='Concluída');
    $('ncStats').innerHTML=stat('Registros',ncs.length,'não conformidades')+stat('Abertas',open.length,'em acompanhamento')+stat('Concluídas',ncs.length-open.length,'ações finalizadas')+stat('Prazo vencido',open.filter(x=>x.when&&x.when<today()).length,'entre as abertas');
    const filter=$('ncFilter').value, rows=ncs.filter(x=>filter==='Todas'||x.status===filter);
    $('ncList').innerHTML=rows.map(x=>{
      const details=[['O que',x.what],['Por quê',x.why],['Onde',x.where],['Quando',dateText(x.when)],['Quem',x.who],['Como',x.how],['Quanto',x.howmuch]];
      return '<details class="nc-item"><summary><span>'+esc(x.titulo)+'</span>'+tag(x.status)+'</summary><div class="nc-meta">'+esc(x.area)+' · Criticidade '+esc(x.criticidade)+' · Prazo '+dateText(x.when)+'</div><div class="nc-details">'+details.map(([k,v])=>'<div><b>'+esc(k)+'</b>'+esc(v)+'</div>').join('')+'</div><button type="button" class="table-button" data-nc="'+esc(x.id)+'">'+(x.status==='Concluída'?'Reabrir ação':'Concluir ação')+'</button></details>';
    }).join('')||'<p class="empty">Nenhum plano para este filtro.</p>';
  }
  function toISO(value){
    const s=clean(value);if(!s)return '';
    let m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m){const br=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!br)return null;m=[s,br[3],br[2],br[1]];}
    const [y,month,day]=m.slice(1).map(Number),d=new Date(Date.UTC(y,month-1,day));
    return d.getUTCFullYear()===y&&d.getUTCMonth()===month-1&&d.getUTCDate()===day?[m[1],m[2],m[3]].join('-'):null;
  }
  function parseCSV(text){
    text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/,1)[0],delimiter=first.includes(';')?';':',';
    let rows=[],row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++}else if(c==='"')quoted=false;else cell+=c}else if(c==='"')quoted=true;else if(c===delimiter){row.push(cell);cell=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>clean(v)))rows.push(row);row=[];cell=''}else cell+=c}
    if(quoted)throw Error('Há aspas sem fechamento no CSV.');
    if(cell||row.length){row.push(cell);if(row.some(v=>clean(v)))rows.push(row)}
    if(!rows.length)throw Error('O arquivo está vazio.');
    const head=rows.shift().map(norm), required=['id','atividade','area','responsavel','situacao','prazo'];
    const indexes=Object.fromEntries([...required,'conclusao'].map(k=>[k,head.indexOf(k)]));
    if(required.some(k=>indexes[k]<0))throw Error('Cabeçalhos esperados: ID, Atividade, Area, Responsavel, Situacao e Prazo.');
    const list=rows.map(row=>Object.fromEntries(Object.entries(indexes).map(([key,i])=>[key,i<0?'':clean(row[i])])));
    return list;
  }
  function analyze(rows,source){
    const valid=[],seen=new Set();let invalid=0,duplicate=0;
    for(const input of rows){
      const x={id:clean(input.id),atividade:clean(input.atividade),area:clean(input.area),responsavel:clean(input.responsavel),prazo:toISO(input.prazo),conclusao:toISO(input.conclusao)};
      const st=norm(input.situacao);x.situacao=st==='aberta'?'Aberta':st==='em andamento'?'Em andamento':st==='concluida'?'Concluída':null;
      if(!x.id||!x.atividade||!x.area||!x.responsavel||!x.situacao||!x.prazo||x.conclusao===null||(x.situacao==='Concluída'&&!x.conclusao)){invalid++;continue}
      const key=norm(x.id);if(seen.has(key)){duplicate++;continue}seen.add(key);valid.push(x);
    }
    return {source,total:rows.length,valid,invalid,duplicate};
  }
  function renderReport(){
    if(!report)report=analyze(parseCSV(window.GESTAO_SAMPLE_CSV),'CSV fictício de exemplo');
    if(report.live) report={...analyze(state.tasks,'Atividades cadastradas neste navegador'),live:true};
    $('reportSource').textContent='Origem: '+report.source+'.';
    $('reportStats').innerHTML=stat('Linhas recebidas',report.total,'antes da limpeza')+stat('Linhas válidas',report.valid.length,'usadas no painel')+stat('Duplicadas',report.duplicate,'IDs repetidos')+stat('Inválidas',report.invalid,'campos ou datas');
    const groups=new Map();for(const x of report.valid)groups.set(x.area,(groups.get(x.area)||0)+1);
    const sorted=[...groups].sort((a,b)=>b[1]-a[1]),max=Math.max(1,...sorted.map(x=>x[1]));
    $('areaBars').innerHTML=sorted.map(([area,n])=>'<div class="area-row"><span>'+esc(area)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(n/max*100)+'%"></div></div><strong>'+n+'</strong></div>').join('')||'<p>Nenhuma linha válida.</p>';
    $('reportTable').innerHTML=report.valid.slice(0,12).map(x=>'<tr><td>'+esc(x.id)+'</td><td>'+esc(x.atividade)+'</td><td>'+esc(x.area)+'</td><td>'+esc(x.responsavel)+'</td><td>'+esc(x.situacao)+'</td><td>'+dateText(x.prazo)+'</td></tr>').join('')||'<tr><td colspan="6" class="empty">Nenhuma linha válida.</td></tr>';
  }
  $('taskFilter').addEventListener('change',renderTasks);$('ncFilter').addEventListener('change',renderNCs);
  $('taskForm').addEventListener('submit',e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));if(!clean(x.atividade)||!clean(x.responsavel)||!toISO(x.prazo)){feedback('taskFeedback','Preencha todos os campos e uma data válida.',true);return}x.id=String(Math.max(1000,...state.tasks.map(v=>Number(v.id)||0))+1);x.atividade=clean(x.atividade);x.responsavel=clean(x.responsavel);x.conclusao='';state.tasks.unshift(x);const ok=save();e.target.reset();renderTasks();feedback('taskFeedback',ok?'Atividade cadastrada neste navegador.':'Atividade adicionada nesta sessão; armazenamento local indisponível.',!ok)});
  $('taskTable').addEventListener('click',e=>{const btn=e.target.closest('[data-task]');if(!btn)return;const x=state.tasks.find(v=>String(v.id)===btn.dataset.task);if(!x)return;if(x.situacao==='Concluída'){x.situacao='Aberta';x.conclusao=''}else{x.situacao='Concluída';x.conclusao=today()}save();renderTasks();feedback('taskFeedback','Situação atualizada.')});
  $('ncForm').addEventListener('submit',e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));if(Object.values(x).some(v=>!clean(v))||!toISO(x.when)){feedback('ncFeedback','Preencha todos os campos e uma data válida.',true);return}x.id=Math.max(100,...state.ncs.map(v=>Number(v.id)||0))+1;x.status='Aberta';state.ncs.unshift(x);const ok=save();e.target.reset();renderNCs();feedback('ncFeedback',ok?'Plano registrado neste navegador.':'Plano adicionado nesta sessão; armazenamento local indisponível.',!ok)});
  $('ncList').addEventListener('click',e=>{const btn=e.target.closest('[data-nc]');if(!btn)return;const x=state.ncs.find(v=>String(v.id)===btn.dataset.nc);if(!x)return;x.status=x.status==='Concluída'?'Aberta':'Concluída';save();renderNCs();feedback('ncFeedback','Situação da ação atualizada.')});
  $('useSample').addEventListener('click',()=>{report=analyze(parseCSV(window.GESTAO_SAMPLE_CSV),'CSV fictício de exemplo');renderReport();feedback('reportMessage','Exemplo carregado.')});
  $('useTasks').addEventListener('click',()=>{report={...analyze(state.tasks,'Atividades cadastradas neste navegador'),live:true};renderReport();feedback('reportMessage','Mostrando os cadastros locais.')});
  $('csvFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error('Use um arquivo CSV de até 2 MB.');report=analyze(parseCSV(await file.text()),file.name);renderReport();feedback('reportMessage','Arquivo analisado no navegador.')}catch(err){feedback('reportMessage',err.message,true)}e.target.value=''});
  $('resetExample').addEventListener('click',()=>{if(!confirm('Restaurar os exemplos? Os registros feitos neste navegador serão substituídos.'))return;state=clone(seed);save();report=null;renderTasks();renderNCs();renderReport();feedback('taskFeedback','Exemplos restaurados.');feedback('ncFeedback','Exemplos restaurados.')});
  window.addEventListener('hashchange',showView);
  showView();
})();
