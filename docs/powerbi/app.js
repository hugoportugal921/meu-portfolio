const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));
const nf = new Intl.NumberFormat('pt-BR');
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compactBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const pct = value => value === null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('pt-BR', {style:'percent',maximumFractionDigits:1}).format(value);
const money = (cents, compact = false) => cents === null || !Number.isFinite(cents) ? '—' : (compact ? compactBrl : brl).format(cents / 100);
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let data, units, products, channels, selectedMonths, activeRows = [], toastTimer;
let state = { period: 'last12', unit: 'all', category: 'all', channel: 'all' };

function toast(message) {
  $('#toast').textContent = message; $('#toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500);
}
function selectTab(name, focus = false) {
  if (!$(`#panel-${name}`)) return;
  $$('#caseTabs [role=tab]').forEach(button => {
    const active = button.dataset.tab === name;
    button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    if (active && focus) button.focus();
  });
  $$('.tab-panel').forEach(panel => { panel.hidden = panel.id !== `panel-${name}`; });
  if (name === 'painel' && data) drawCharts();
}
$$('#caseTabs [role=tab]').forEach(button => button.addEventListener('click', () => selectTab(button.dataset.tab)));
$('#caseTabs').addEventListener('keydown', event => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key) || !event.target.matches('[role=tab]')) return;
  event.preventDefault(); const tabs = $$('#caseTabs [role=tab]'); const i = tabs.indexOf(event.target);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  selectTab(tabs[next].dataset.tab, true);
});
function getMonths() {
  if (state.period === 'all') return data.months;
  if (state.period === 'last12') return data.months.slice(-12);
  if (state.period.startsWith('month:')) return [state.period.slice(6)];
  return data.months.filter(month => month.startsWith(state.period));
}
function filterRows(months = selectedMonths) {
  const allowed = new Set(months);
  return data.sales.filter(row => allowed.has(row[2].slice(0,7)) &&
    (state.unit === 'all' || row[4] === Number(state.unit)) &&
    (state.category === 'all' || products.get(row[3]).Categoria === state.category) &&
    (state.channel === 'all' || row[5] === Number(state.channel)));
}
function calculate(rows) {
  let gross = 0, discounts = 0, cost = 0, items = 0; const orders = new Set();
  for (const row of rows) { gross += row[6] * row[7]; discounts += row[9]; cost += row[6] * row[8]; items += row[6]; orders.add(row[1]); }
  const revenue = gross - discounts, profit = revenue - cost;
  return {gross, discounts, cost, revenue, profit, margin:revenue ? profit/revenue : null, orders:orders.size, ticket:orders.size ? revenue/orders.size : null, items};
}
function targetFor(months = selectedMonths, unit = state.unit) {
  if (state.category !== 'all' || state.channel !== 'all') return null;
  const allowed = new Set(months);
  const rows = data.budgets.filter(row => allowed.has(row[0]) && (unit === 'all' || row[1] === Number(unit)));
  return rows.length ? rows.reduce((sum, row) => sum + row[2], 0) : null;
}
function previousYear() {
  const shifted = selectedMonths.map(month => `${Number(month.slice(0,4))-1}${month.slice(4)}`);
  if (!shifted.every(month => data.months.includes(month))) return null;
  const rows = filterRows(shifted); return rows.length ? calculate(rows).revenue : null;
}
function previousMonth() {
  if (selectedMonths.length !== 1) return null;
  const [year,month] = selectedMonths[0].split('-').map(Number);
  const prior = month === 1 ? `${year-1}-12` : `${year}-${String(month-1).padStart(2,'0')}`;
  if (!data.months.includes(prior)) return null;
  const rows = filterRows([prior]); return rows.length ? calculate(rows).revenue : null;
}
function ytdRevenue() {
  const end = selectedMonths.at(-1);
  return calculate(filterRows(data.months.filter(month => month.startsWith(end.slice(0,4)) && month <= end))).revenue;
}
function setKpi(id, text, title) { $(id).textContent = text; if(title) $(id).title = title; }
function render() {
  if (!data) return;
  selectedMonths = getMonths(); activeRows = filterRows(); const value = calculate(activeRows); const target = targetFor(); const prior = previousYear();
  const unitLabel = state.unit === 'all' ? 'Todas as unidades' : units.get(Number(state.unit)).Unidade;
  $('#filterContext').textContent = `${selectedMonths[0]} a ${selectedMonths.at(-1)} · ${unitLabel} · ${nf.format(activeRows.length)} itens de pedido · ${nf.format(value.orders)} pedidos distintos`;
  setKpi('#kRevenue', money(value.revenue,true), money(value.revenue));
  setKpi('#kProfit', money(value.profit,true), money(value.profit));
  setKpi('#kMargin', pct(value.margin)); setKpi('#kTarget', target ? pct(value.revenue/target) : '—');
  $('#targetHint').textContent = target === null ? 'Meta não definida por categoria ou canal' : `Meta: ${money(target,true)}`;
  setKpi('#kOrders', nf.format(value.orders)); setKpi('#kTicket', money(value.ticket));
  setKpi('#kYoY', prior ? pct((value.revenue-prior)/prior) : '—');
  $('#kYoY').title = prior === null ? 'Histórico insuficiente para comparar todo o intervalo com o ano anterior.' : `Receita anterior: ${money(prior)}`;
  setKpi('#kItems', nf.format(value.items));
  drawCharts(); renderTable(); renderMeasure();
}
function drawCharts() {
  if (!data) return;
  const monthly = selectedMonths.map(month => ({month,revenue:calculate(activeRows.filter(row => row[2].startsWith(month))).revenue,target:targetFor([month])}));
  const maximum = Math.max(1,...monthly.flatMap(row => [row.revenue,row.target??0]))*1.12;
  const width=650,height=245,pad={left:53,right:15,top:16,bottom:35};
  const x=i=>pad.left+(monthly.length>1?i/(monthly.length-1):.5)*(width-pad.left-pad.right);
  const y=value=>height-pad.bottom-value/maximum*(height-pad.top-pad.bottom);
  let svg=`<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">`;
  for(let i=0;i<4;i++) {
    const val=maximum*i/3,cy=y(val);
    svg+=`<line x1="${pad.left}" x2="${width-pad.right}" y1="${cy}" y2="${cy}" stroke="#e5e9dd"/><text x="${pad.left-8}" y="${cy+4}" text-anchor="end">${escape(new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(val/100))}</text>`;
  }
  const points=key=>monthly.map((row,i)=>`${x(i)},${y(row[key])}`).join(' ');
  if(monthly.length) {
    svg+=`<polyline fill="none" stroke="#506c38" stroke-width="3" stroke-linejoin="round" points="${points('revenue')}"/>`;
    if(monthly.every(row=>row.target!==null)) svg+=`<polyline fill="none" stroke="#d8a631" stroke-width="2" stroke-dasharray="5 4" points="${points('target')}"/>`;
    monthly.forEach((row,i)=>{
      svg+=`<circle cx="${x(i)}" cy="${y(row.revenue)}" r="3.5" fill="#506c38"><title>${escape(row.month+': '+money(row.revenue))}</title></circle>`;
      if(i%Math.max(1,Math.ceil(monthly.length/7))===0||i===monthly.length-1) svg+=`<text x="${x(i)}" y="${height-10}" text-anchor="middle">${row.month.slice(5)}/${row.month.slice(2,4)}</text>`;
    });
  }
  $('#trendChart').innerHTML=svg+'</svg>';
  $('#trendChart').setAttribute('aria-label',monthly.map(row=>`${row.month}: receita ${money(row.revenue)}${row.target===null?'':', meta '+money(row.target)}`).join('; '));
  const byUnit=data.units.filter(unit=>state.unit==='all'||unit.UnidadeID===Number(state.unit)).map(unit=>({...unit,revenue:calculate(activeRows.filter(row=>row[4]===unit.UnidadeID)).revenue})).sort((a,b)=>b.revenue-a.revenue);
  const maxUnit=Math.max(1,...byUnit.map(row=>row.revenue));
  $('#unitChart').replaceChildren(...byUnit.map(unit=>{
    const button=document.createElement('button');button.className='unit-bar';button.type='button';
    button.setAttribute('aria-label',`Filtrar ${unit.Unidade}: ${money(unit.revenue)}`);
    const name=document.createElement('span');name.textContent=unit.Unidade;
    const track=document.createElement('span');track.className='track';const fill=document.createElement('span');fill.className='fill';fill.style.width=`${unit.revenue/maxUnit*100}%`;
    const label=document.createElement('span');label.className='bar-value';label.textContent=money(unit.revenue,true);
    track.append(fill,label);button.append(name,track);button.addEventListener('click',()=>{state.unit=String(unit.UnidadeID);$('#unit').value=state.unit;render();});return button;
  }));
}
function renderTable() {
  const sorted=[...activeRows].sort((a,b)=>b[2].localeCompare(a[2])||b[0].localeCompare(a[0]));
  $('#tableContext').textContent=`Exibindo ${Math.min(12,sorted.length)} de ${nf.format(sorted.length)} itens da seleção. A exportação inclui todos os itens filtrados.`;
  $('#salesTable').innerHTML=sorted.length?sorted.slice(0,12).map(row=>{
    const net=row[6]*row[7]-row[9],profit=net-row[6]*row[8];
    return `<tr><td>${row[2].split('-').reverse().join('/')}</td><td>${escape(row[1])}</td><td>${escape(units.get(row[4]).Unidade)}</td><td>${escape(products.get(row[3]).Produto)}</td><td class="number">${nf.format(row[6])}</td><td class="number">${money(net)}</td><td class="number">${money(profit)}</td></tr>`;
  }).join(''):'<tr><td colspan="7">Nenhum item encontrado para a seleção.</td></tr>';
}
function measureResult(name) {
  const v=calculate(activeRows),target=targetFor(),priorYear=previousYear(),priorMonth=previousMonth();
  return ({'Receita Bruta':v.gross,'Descontos':v.discounts,'Receita Líquida':v.revenue,'Custo das Vendas':v.cost,'Lucro Bruto':v.profit,'Margem Bruta %':v.margin,'Pedidos':v.orders,'Itens Vendidos':v.items,'Ticket Médio':v.ticket,'Meta Receita':target,'Atingimento %':target?v.revenue/target:null,'Desvio da Meta':target===null?null:v.revenue-target,'Receita Ano Anterior':priorYear,'Variação Anual %':priorYear?(v.revenue-priorYear)/priorYear:null,'Receita YTD':ytdRevenue(),'Receita Mês Anterior':priorMonth,'Variação Mensal %':priorMonth?(v.revenue-priorMonth)/priorMonth:null,'Unidade Selecionada':state.unit==='all'?'Todas as unidades':units.get(Number(state.unit)).Unidade})[name];
}
function renderMeasure() {
  if(!data)return;const measure=data.measures.find(item=>item.name===$('#measureSelect').value);if(!measure)return;
  $('#measureDescription').textContent=measure.description;$('#daxCode').textContent=`${measure.name} =\n${measure.dax}`;
  const value=measureResult(measure.name);
  $('#measureValue').textContent=value===null?'Indisponível neste recorte':measure.format==='moeda'?money(value):measure.format==='percentual'?pct(value):measure.format==='inteiro'?nf.format(value):value;
}
$('#measureSelect').addEventListener('change',renderMeasure);
for(const [id,key] of [['#period','period'],['#unit','unit'],['#category','category'],['#channel','channel']]) $(id).addEventListener('change',event=>{state[key]=event.target.value;render();});
$('#resetFilters').addEventListener('click',()=>{state={period:'all',unit:'all',category:'all',channel:'all'};for(const[id,key]of[['#period','period'],['#unit','unit'],['#category','category'],['#channel','channel']])$(id).value=state[key];render();});
$$('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#'+button.dataset.copy).textContent);toast('Código copiado.');}catch{toast('Selecione o código e copie pelo navegador.');}}));
$('#exportCsv').addEventListener('click',()=>{
  if(!data)return;const headers=['ItemID','PedidoID','DataVenda','Unidade','Produto','Canal','Quantidade','ReceitaLiquida','CustoTotal','LucroBruto'];
  const rows=activeRows.map(row=>{const revenue=row[6]*row[7]-row[9],cost=row[6]*row[8];return[row[0],row[1],row[2],units.get(row[4]).Unidade,products.get(row[3]).Produto,channels.get(row[5]).Canal,row[6],(revenue/100).toFixed(2),(cost/100).toFixed(2),((revenue-cost)/100).toFixed(2)];});
  const quote=value=>'"'+String(value).replaceAll('"','""')+'"';
  const csv='\uFEFF'+[headers,...rows].map(row=>row.map(quote).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='AtlasBI_selecao_dados_simulados.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast(`CSV preparado com ${nf.format(rows.length)} itens.`);
});

try {
  const response=await fetch('data.json');if(!response.ok)throw new Error('Não foi possível carregar a base.');data=await response.json();
  units=new Map(data.units.map(row=>[row.UnidadeID,row]));products=new Map(data.products.map(row=>[row.ProdutoID,row]));channels=new Map(data.channels.map(row=>[row.CanalID,row]));
  function option(select,value,label){const el=document.createElement('option');el.value=value;el.textContent=label;$(select).append(el);}
  data.months.forEach(month=>option('#period','month:'+month,new Date(month+'-15T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})));
  data.units.forEach(row=>option('#unit',row.UnidadeID,row.Unidade));
  [...new Set(data.products.map(row=>row.Categoria))].forEach(category=>option('#category',category,category));
  data.channels.forEach(row=>option('#channel',row.CanalID,row.Canal));
  data.measures.forEach(row=>option('#measureSelect',row.name,row.name));$('#measureSelect').value='Receita Líquida';
  $('#mCode').textContent=data.mExample;$('#rlsCode').textContent=data.rls;
  for(const[id,key]of[['#qSource','linhasOriginais'],['#qDuplicates','duplicadosRemovidos'],['#qInvalid','invalidosRemovidos'],['#qClean','linhasFinais']])$(id).textContent=nf.format(data.quality[key]);
  render();
} catch(error) {
  $('#filterContext').textContent='A prévia não pôde carregar a base. Recarregue a página ou baixe o pacote Power BI.';toast('Não foi possível carregar a demonstração.');console.error(error);
}
