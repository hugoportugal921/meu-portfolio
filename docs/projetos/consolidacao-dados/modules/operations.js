import { toCSV } from './report-worker.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const integer = value => Number(value).toLocaleString('pt-BR');
const currency = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function mount(container, store) {
  let disposed = false, counter = 0, importing = false;
  const jobs = [];
  const urls = new Set();
  let worker;
  container.innerHTML = `
    <header class="page-intro">
      <p class="eyebrow">PROJETO 01 / AUTOMAÇÃO OPERACIONAL</p>
      <h1 class="section-title">Do dado bruto<br>ao relatório.</h1>
      <p class="muted">Importe registros, consolide informações e gere relatórios em segundo plano. O processamento acontece em um Web Worker, mantendo a navegação disponível.</p>
    </header>
    <div class="notice" id="op-source"></div>
    <div class="metric-grid" id="op-metrics"></div>
    <div class="split-grid">
      <section class="panel">
        <div class="panel-header"><div><p class="eyebrow">01 / ENTRADA</p><h2>Consolidar registros</h2></div><span class="badge">CSV</span></div>
        <div class="op-dropzone" id="op-dropzone" role="button" tabindex="0" aria-label="Selecionar arquivo CSV ou arraste o arquivo até esta área" style="padding:32px 20px;border:1px dashed var(--border,#3b4655);border-radius:12px;text-align:center;cursor:pointer;margin:20px 0">
          <span aria-hidden="true" style="font-size:28px">↥</span><p><strong>Arraste seu CSV para cá</strong></p><p class="muted">ou clique para selecionar · até 10 MB</p>
        </div>
        <input id="op-file" type="file" accept=".csv,text/csv" hidden>
        <p class="muted" style="font-size:12px;overflow-wrap:anywhere">Colunas: <code>id, date, unit, category, status, amount, duration</code>. Datas em AAAA-MM-DD; duração em minutos. IDs repetidos são ignorados.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">
          <button class="button ghost" id="op-sample">Baixar CSV de exemplo</button>
          <button class="button ghost" id="op-reset">Restaurar amostra</button>
        </div>
        <p class="status-line" id="op-feedback" role="status" aria-live="polite">Os arquivos são processados neste navegador.</p>
      </section>
      <section class="panel">
        <div class="panel-header"><div><p class="eyebrow">02 / PROCESSAMENTO</p><h2>Central de relatórios</h2></div><span class="badge">ASSÍNCRONO</span></div>
        <p class="muted">Um resumo por unidade com volume, situação, valor total e duração média dos registros da base atual.</p>
        <button class="button primary" id="op-report" style="margin:16px 0">Gerar relatório consolidado <span aria-hidden="true">↗</span></button>
        <div id="op-jobs" aria-live="polite"></div>
      </section>
    </div>
    <section class="panel" style="margin-top:22px">
      <div class="panel-header"><div><p class="eyebrow">03 / BASE CONSOLIDADA</p><h2>Últimos registros</h2></div><span class="badge" id="op-row-count"></span></div>
      <div class="table-wrap" id="op-table"></div>
    </section>
    <p class="muted" style="font-size:12px;margin-top:18px">Demonstração funcional de processamento local. As tarefas desta sessão são encerradas quando você sai desta tela; os dados continuam disponíveis neste projeto até recarregar a página.</p>`;
  const find = selector => container.querySelector(selector);
  const setImporting = value => {
    importing = value;
    find('#op-reset').disabled = value;
  };
  const feedback = (message, error = false) => {
    find('#op-feedback').textContent = message;
    find('#op-feedback').className = error ? 'status-line error' : 'status-line';
  };
  const renderJobs = () => {
    find('#op-jobs').innerHTML = jobs.length ? jobs.map(job => `
      <div class="op-job" style="border-top:1px solid var(--border,#303a48);padding:15px 0">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><strong>${escape(job.title)}</strong><span class="badge">${escape(job.state)}</span></div>
        <p class="${job.error ? 'error' : 'muted'}" style="font-size:12px;margin:8px 0">${escape(job.message)}</p>
        ${job.state === 'Na fila' || job.state === 'Processando' ? `<progress value="${job.progress}" max="100" style="width:100%;height:5px" aria-label="Progresso de ${escape(job.title)}"></progress>` : ''}
        ${job.url ? `<a class="button ghost" href="${job.url}" download="relatorio-por-unidade.csv">Baixar relatório CSV ↓</a>` : ''}
      </div>`).join('') : '<div class="empty"><p>Nenhuma tarefa nesta sessão.</p><p class="muted">Gere seu primeiro relatório para acompanhar o processamento.</p></div>';
  };
  const renderData = () => {
    if (disposed) return;
    const rows = store.getRows();
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    const source = typeof store.getSource === 'function' ? store.getSource() : 'Dados de exemplo simulados';
    find('#op-source').textContent = `${typeof source === 'string' ? source : 'Base demonstrativa'} · Os indicadores abaixo são calculados sobre os registros desta base.`;
    find('#op-metrics').innerHTML = [
      ['REGISTROS NA BASE', integer(rows.length)],
      ['UNIDADES', integer(new Set(rows.map(row => row.unit)).size)],
      ['VALOR CONSOLIDADO', currency(total)],
      ['CONCLUÍDOS', integer(rows.filter(row => row.status === 'Concluído').length)]
    ].map(([label, value]) => `<div class="metric"><span class="muted">${label}</span><strong>${value}</strong></div>`).join('');
    find('#op-row-count').textContent = `${integer(rows.length)} registros`;
    const recent = [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 8);
    find('#op-table').innerHTML = recent.length ? `<table><thead><tr><th>ID</th><th>Data</th><th>Unidade</th><th>Categoria</th><th>Valor</th><th>Situação</th></tr></thead><tbody>${recent.map(row => `<tr><td>${escape(row.id)}</td><td>${escape(row.date.split('-').reverse().join('/'))}</td><td>${escape(row.unit)}</td><td>${escape(row.category)}</td><td>${currency(row.amount)}</td><td><span class="badge">${escape(row.status)}</span></td></tr>`).join('')}</tbody></table>` : '<p class="empty">Nenhum registro. Importe um CSV para começar.</p>';
    find('#op-report').disabled = !rows.length || !worker;
  };
  const addJob = (type, title) => {
    const job = { id: `op-${Date.now()}-${++counter}`, type, title, state: 'Na fila', progress: 0, message: 'Aguardando o Web Worker' };
    jobs.unshift(job);
    if (jobs.length > 8) {
      const removed = jobs.pop();
      if (removed.url) { URL.revokeObjectURL(removed.url); urls.delete(removed.url); }
    }
    renderJobs();
    return job;
  };
  try {
    worker = new Worker(new URL('./report-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = event => {
      if (disposed) return;
      const { id, kind, value, message, result } = event.data;
      const job = jobs.find(item => item.id === id);
      if (!job) return;
      if (kind === 'progress') { job.state = 'Processando'; job.progress = value; job.message = message; }
      else if (kind === 'error') {
        job.state = 'Falhou'; job.message = message; job.error = true;
        if (job.type === 'import') { setImporting(false); feedback(message, true); }
      } else if (kind === 'done') {
        job.state = 'Concluído'; job.progress = 100;
        if (job.type === 'import') {
          const currentIds = new Set(store.getRows().map(row => row.id));
          const unique = result.rows.filter(row => !currentIds.has(row.id));
          const duplicates = result.duplicates + result.rows.length - unique.length;
          if (unique.length) store.appendRows(unique);
          job.message = `${integer(unique.length)} registros adicionados; ${integer(duplicates)} IDs repetidos ignorados.`;
          setImporting(false); feedback(job.message);
        } else {
          job.message = `${integer(result.count)} registros consolidados em ${integer(result.units)} unidades. Pronto para download.`;
          job.url = URL.createObjectURL(new Blob([result.csv], { type: 'text/csv;charset=utf-8' }));
          urls.add(job.url);
        }
      }
      renderJobs();
    };
    worker.onerror = () => {
      for (const job of jobs) {
        if (job.state === 'Na fila' || job.state === 'Processando') { job.state = 'Falhou'; job.error = true; job.message = 'O processamento foi interrompido. Reabra esta demonstração para tentar novamente.'; }
      }
      setImporting(false);
      feedback('Não foi possível iniciar o processamento. Abra o projeto por um servidor local ou pela versão publicada.', true);
      renderJobs();
      worker.terminate(); worker = null; renderData();
    };
  } catch {
    feedback('Seu navegador não disponibilizou Web Workers. Abra esta página por um servidor local ou pela versão publicada.', true);
  }
  const importFile = async file => {
    if (!file || disposed) return;
    if (!worker) return feedback('O processador não está disponível. Reabra esta demonstração.', true);
    if (importing) return feedback('Aguarde a importação atual antes de enviar outro arquivo.', true);
    if (file.size > 10 * 1024 * 1024) return feedback('O arquivo ultrapassa 10 MB. Divida a base em arquivos menores.', true);
    if (!/\.csv$/i.test(file.name)) return feedback('Selecione um arquivo com extensão .csv.', true);
    setImporting(true);
    const job = addJob('import', 'Importação de CSV');
    job.message = `Lendo ${file.name}`; renderJobs();
    try {
      const text = await file.text();
      if (disposed) return;
      worker.postMessage({ id: job.id, type: 'import', text, existingIds: store.getRows().map(row => row.id) });
      feedback('Arquivo enviado para validação e consolidação em segundo plano.');
    } catch {
      setImporting(false); job.state = 'Falhou'; job.error = true; job.message = 'Não foi possível ler o arquivo. Selecione-o novamente.'; feedback(job.message, true); renderJobs();
    }
  };
  const download = (content, name) => {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
    urls.add(url);
  };
  const dropzone = find('#op-dropzone');
  const input = find('#op-file');
  dropzone.addEventListener('click', () => input.click());
  dropzone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });
  input.addEventListener('change', () => { importFile(input.files[0]); input.value = ''; });
  dropzone.addEventListener('dragover', event => { event.preventDefault(); dropzone.style.borderColor = 'var(--accent,#c8f36a)'; });
  dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = ''; });
  dropzone.addEventListener('drop', event => { event.preventDefault(); dropzone.style.borderColor = ''; importFile(event.dataTransfer.files[0]); });
  find('#op-sample').addEventListener('click', () => {
    download(toCSV(store.getRows().slice(0, 30)), 'amostra-operacoes.csv');
    feedback('CSV de exemplo gerado. Ao reimportar esta mesma amostra, os IDs já existentes serão ignorados.');
  });
  find('#op-reset').addEventListener('click', () => {
    if (importing) return feedback('Aguarde a importação terminar antes de restaurar a amostra.');
    store.resetSample(); feedback('Amostra simulada restaurada. Os registros importados foram substituídos pela amostra original.');
  });
  find('#op-report').addEventListener('click', () => {
    if (!worker || !store.getRows().length) return;
    const active = jobs.filter(job => job.state === 'Na fila' || job.state === 'Processando').length;
    if (active >= 4) return feedback('Aguarde as tarefas em processamento antes de gerar outro relatório.');
    const job = addJob('report', 'Relatório por unidade');
    worker.postMessage({ id: job.id, type: 'report', rows: store.getRows() });
  });
  const unsubscribe = store.subscribe(renderData);
  renderData(); renderJobs();
  return () => {
    disposed = true;
    if (worker) worker.terminate();
    unsubscribe();
    for (const url of urls) URL.revokeObjectURL(url);
  };
}
