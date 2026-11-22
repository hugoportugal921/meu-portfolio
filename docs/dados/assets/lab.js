(() => {
  'use strict';
  const all = window.LAB_DATA;
  if (!all) return;
  const $ = id => document.getElementById(id);
  const int = v => new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 0}).format(v);
  const dec = v => new Intl.NumberFormat('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(v);
  const money = v => new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(v);
  const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const dateLabel = value => { const [y,m] = value.split('-'); return months[Number(m)-1] + '/' + y.slice(2); };
  const ns = 'http://www.w3.org/2000/svg';
  function node(tag, attrs, text) { const n=document.createElementNS(ns,tag); Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v))); if(text!==undefined)n.textContent=text; return n; }
  function lineChart(svg, observed, forecast, options={}) {
    svg.replaceChildren();
    const width=760, height=280, left=76, right=22, top=18, bottom=40;
    const allValues=[...observed.map(x=>x.value), ...forecast.flatMap(x=>[x.value,x.low??x.value,x.high??x.value])];
    if (!allValues.length || allValues.some(x=>!Number.isFinite(x))) return;
    let lo=Math.min(...allValues), hi=Math.max(...allValues);
    const padding=Math.max((hi-lo)*.12, 1); lo=Math.max(0,lo-padding); hi+=padding;
    if (lo>=hi) { lo=0; hi=1; }
    const count=observed.length+forecast.length;
    const x=i=>left+(width-left-right)*i/Math.max(count-1,1);
    const y=v=>top+(height-top-bottom)*(hi-v)/(hi-lo);
    for(let i=0;i<=4;i++){
      const value=lo+(hi-lo)*i/4, yy=y(value);
      svg.append(node('line',{x1:left,y1:yy,x2:width-right,y2:yy,class:'chart-grid'}));
      svg.append(node('text',{x:left-10,y:yy+4,'text-anchor':'end',class:'chart-label'},options.yLabel?options.yLabel(value):int(value)));
    }
    if (forecast.length && forecast.every(r=>Number.isFinite(r.low)&&Number.isFinite(r.high))) {
      const start=observed.length;
      const upper=forecast.map((r,i)=>`${x(start+i)},${y(r.high)}`);
      const lower=[...forecast].reverse().map((r,j)=>`${x(start+forecast.length-1-j)},${y(r.low)}`);
      svg.append(node('polygon',{points:[...upper,...lower].join(' '),class:'chart-band'}));
    }
    if(observed.length) svg.append(node('polyline',{points:observed.map((r,i)=>`${x(i)},${y(r.value)}`).join(' '),class:'chart-line'}));
    if(forecast.length){
      const points=[];
      if(observed.length)points.push(`${x(observed.length-1)},${y(observed[observed.length-1].value)}`);
      forecast.forEach((r,i)=>points.push(`${x(observed.length+i)},${y(r.value)}`));
      svg.append(node('polyline',{points:points.join(' '),class:'chart-forecast'}));
    }
    const labels=[...observed,...forecast];
    const indexes=[...new Set([0,Math.floor((count-1)/3),Math.floor((count-1)*2/3),count-1])];
    indexes.forEach(i=>svg.append(node('text',{x:x(i),y:height-10,'text-anchor':i===0?'start':i===count-1?'end':'middle',class:'chart-label'},labels[i].label||'')));
    if(Number.isFinite(options.markerIndex)){
      const i=options.markerIndex, p=observed[i]; if(p)svg.append(node('circle',{cx:x(i),cy:y(p.value),r:5,class:'chart-dot'}));
    }
  }

  function startCars(){
    const c=all.cars, m=c.model;
    $('carsRaw').textContent=int(c.raw_count); $('carsClean').textContent=int(c.filtered_count);
    $('carsTest').textContent=int(c.test_count); $('carsMae').textContent=money(c.mae);
    const conditionLabels={'não informado':'Não informado','good':'Bom','excellent':'Excelente','like new':'Como novo','fair':'Regular','new':'Novo','salvage':'Danificado'};
    const titleCase=s=>s.replace(/\b\w/g,x=>x.toUpperCase());
    c.brands.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=titleCase(v);$('carBrand').append(o);});
    c.conditions.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=conditionLabels[v]||v;$('carCondition').append(o);});
    $('carBrand').value=c.brands.includes('ford')?'ford':c.brands[0];
    $('carCondition').value=c.conditions.includes('good')?'good':c.conditions[0];
    $('carYear').min=c.year_min; $('carYear').max=c.year_max;
    const maxKm=Math.floor(c.odometer_max_miles*1.609344); $('carKm').max=maxKm;
    const estimate=(year,km,brand,condition)=>m.intercept+(year-m.mean.year)/m.scale.year*m.numeric.year+(km/1.609344-m.mean.odometer)/m.scale.odometer*m.numeric.odometer+m.brand[brand]+m.condition[condition];
    $('carsDetails').textContent=`A regressão teve MAE de ${money(c.mae)} em ${int(c.test_count)} anúncios não usados no treino; a referência que sempre prevê a mediana teve MAE de ${money(c.baseline_mae)}. O R² no teste foi ${dec(c.r2)}. A amostra é pequena, não aleatória, e descreve anúncios históricos, não vendas confirmadas.`;
    function update(){
      const y=Number($('carYear').value), km=Number($('carKm').value), brand=$('carBrand').value, cond=$('carCondition').value;
      const valid=$('carYear').value!=='' && Number.isInteger(y) && y>=c.year_min && y<=c.year_max && $('carKm').value!=='' && Number.isFinite(km) && km>=0 && km<=maxKm && Object.hasOwn(m.brand,brand) && Object.hasOwn(m.condition,cond);
      if(!valid){$('carError').textContent=`Informe ano entre ${c.year_min} e ${c.year_max} e quilometragem entre 0 e ${int(maxKm)} km.`; $('carEstimate').textContent='—'; $('carChart').replaceChildren(); $('carInsight').textContent=''; return;}
      const value=estimate(y,km,brand,cond);
      if(value<=0){$('carError').textContent='Esta combinação produziu uma estimativa inválida. Experimente outra combinação dentro da amostra.'; $('carEstimate').textContent='—';}
      else {$('carError').textContent='';$('carEstimate').textContent=money(value);}
      const points=[]; for(let i=0;i<=6;i++){const k=maxKm*i/6; points.push({value:Math.max(0,estimate(y,k,brand,cond)),label:i===0?'0 km':i===6?int(maxKm)+' km':int(k/1000)+' mil'});}
      lineChart($('carChart'),points,[],{yLabel:v=>'$ '+int(v)});
      const change=estimate(y,km+10000,brand,cond)-value;
      $('carInsight').textContent=`Nesta regressão, 10 mil km adicionais ${change<0?'reduzem':'aumentam'} a estimativa em aproximadamente ${money(Math.abs(change))}, mantendo as demais variáveis. O gráfico limita valores negativos a zero para facilitar a leitura.`;
    }
    $('carForm').addEventListener('submit',e=>e.preventDefault());
    ['carBrand','carYear','carKm','carCondition'].forEach(id=>$(id).addEventListener('input',update)); update();
  }

  function startSales(){
    const s=all.sales;
    $('salesCount').textContent=int(s.n); $('salesLast').textContent=dateLabel(s.end);
    $('salesMae').textContent=int(s.mae); $('salesMape').textContent=dec(s.mape)+'%';
    $('salesMethod').textContent=s.method;
    $('salesCompare').textContent=`Na validação: regressão ${int(s.validation_trend_mae)}; referência sazonal ${int(s.validation_seasonal_mae)} milhões de dólares de MAE. O último ano foi reservado para teste independente.`;
    $('salesDetails').textContent=`Nos 12 meses finais reservados para teste, o método escolhido anteriormente apresentou erro absoluto médio de ${int(s.mae)} milhões de dólares e erro percentual médio de ${dec(s.mape)}%. A série é agregada; não há variáveis de promoções nem de feriados para medir seus efeitos separadamente.`;
    const body=$('salesTable');
    s.forecast.forEach(v=>{const tr=document.createElement('tr');[dateLabel(v.date),int(v.value),`${int(v.low)} a ${int(v.high)}`].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});body.append(tr);});
    const seasonal=$('seasonalityBars'), peak=Math.max(...s.seasonality.map(r=>r.index));
    s.seasonality.forEach(r=>{const item=document.createElement('div');item.className='season-item';item.setAttribute('aria-label',`${months[r.month-1]}: ${dec(r.index*100)}% da média mensal`);const meter=document.createElement('div');meter.className='season-track';const fill=document.createElement('span');fill.style.height=(r.index/peak*100)+'%';meter.append(fill);const label=document.createElement('span');label.textContent=months[r.month-1];const value=document.createElement('strong');value.textContent=int(r.index*100)+'%';item.append(meter,label,value);seasonal.append(item);});
    function update(){const n=Number($('historySelect').value);const hist=s.history.slice(-n).map(r=>({value:r.value,label:dateLabel(r.date)}));const f=s.forecast.map(r=>({...r,label:dateLabel(r.date)}));lineChart($('salesChart'),hist,f,{yLabel:v=>int(v)});}
    $('historySelect').addEventListener('change',update);update();
  }

  function startSteel(){
    const s=all.steel;
    const names={'Pastry':'Pastry','Z_Scratch':'Risco em Z','K_Scatch':'Risco em K','Stains':'Manchas','Dirtiness':'Sujeira','Bumps':'Abaulamentos','Other_Faults':'Outras falhas'};
    $('steelAll').textContent=int(s.total);
    let selected='';
    function update(){
      const group=s.groups[$('steelSelect').value], ordered=[...group.faults].sort((a,b)=>b.count-a.count);
      if(!ordered.some(r=>r.label===selected))selected=ordered[0].label;
      $('steelCount').textContent=int(group.total);$('steelTop').textContent=names[ordered[0].label];
      const active=ordered.find(r=>r.label===selected);
      $('steelSelected').textContent=names[active.label];
      $('steelInfo').textContent=`${int(active.count)} registros · ${dec(active.count/group.total*100)}% do recorte · área mediana de ${int(active.median_area)} pixels.`;
      const container=$('steelBars'); container.replaceChildren();
      ordered.forEach(r=>{
        const b=document.createElement('button');b.className='bar-button';b.type='button';b.setAttribute('aria-pressed',String(r.label===selected));
        b.setAttribute('aria-label',`${names[r.label]}: ${int(r.count)} registros`);
        const title=document.createElement('span');title.className='bar-name';title.textContent=names[r.label];
        const track=document.createElement('span');track.className='bar-track';track.setAttribute('aria-hidden','true');const fill=document.createElement('span');fill.className='bar-fill';fill.style.display='block';fill.style.width=(r.count/ordered[0].count*100)+'%';track.append(fill);
        const value=document.createElement('span');value.className='bar-number';value.textContent=int(r.count)+' · '+dec(r.count/group.total*100)+'%';
        b.append(title,track,value);b.addEventListener('click',()=>{selected=r.label;update();});container.append(b);
      });
      const overall=[...s.groups.Todos.faults].sort((a,b)=>b.count-a.count)[0];
      $('steelDetails').textContent=`Na base completa, ${names[overall.label]} reúne ${int(overall.count)} de ${int(s.total)} registros com falhas. A frequência ajuda a priorizar uma investigação, mas não estabelece causa, custo nem taxa de defeitos de toda a produção.`;
    }
    $('steelSelect').addEventListener('change',()=>{selected='';update();});update();
  }
  if(document.body.dataset.project==='carros')startCars();
  if(document.body.dataset.project==='vendas')startSales();
  if(document.body.dataset.project==='qualidade')startSteel();
})();
