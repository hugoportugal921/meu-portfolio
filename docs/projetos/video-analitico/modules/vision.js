/** Percentage of changed RGBA pixels inside a normalized, image-clipped region. */
export function calculateMotion(current, previous, width, height, roi, pixelThreshold) {
  if (width <= 0 || height <= 0 || roi.w <= 0 || roi.h <= 0) return 0;
  const minX = Math.max(0, Math.min(width, Math.floor(roi.x * width)));
  const minY = Math.max(0, Math.min(height, Math.floor(roi.y * height)));
  const maxX = Math.max(0, Math.min(width, Math.ceil((roi.x + roi.w) * width)));
  const maxY = Math.max(0, Math.min(height, Math.ceil((roi.y + roi.h) * height)));
  const total = (maxX - minX) * (maxY - minY);
  if (maxX <= minX || maxY <= minY) return 0;
  let changed = 0;
  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const i = (y * width + x) * 4;
      const currentLuminance = current[i] * 0.299 + current[i + 1] * 0.587 + current[i + 2] * 0.114;
      const previousLuminance = previous[i] * 0.299 + previous[i + 1] * 0.587 + previous[i + 2] * 0.114;
      if (Math.abs(currentLuminance - previousLuminance) >= pixelThreshold) changed += 1;
    }
  }
  return changed / total * 100;
}

/** Release every track listener before reporting a camera interruption. */
export function observeCameraEnd(camera, onEnded) {
  const tracks = typeof camera.getVideoTracks === 'function' ? camera.getVideoTracks() : camera.getTracks();
  let active = true;
  const remove = () => tracks.forEach(track => track.removeEventListener('ended', ended));
  const ended = () => {
    if (!active) return;
    active = false;
    remove();
    onEnded();
  };
  tracks.forEach(track => track.addEventListener('ended', ended));
  if (tracks.some(track => track.readyState === 'ended')) queueMicrotask(ended);
  return () => { active = false; remove(); };
}

/** Keep a normalized analysis region visible, with a minimum size of 4%. */
export function constrainROI(region) {
  const bound = (value, min, max) => Math.max(min, Math.min(max, value));
  const x = bound(region.x, 0, 0.96);
  const y = bound(region.y, 0, 0.96);
  return { x, y, w: bound(region.w, 0.04, 1 - x), h: bound(region.h, 0.04, 1 - y) };
}

export function mount(container, store) {
  container.innerHTML = `
    <style>.vision-roi-controls{border:0;padding:0;margin:0 0 20px}.vision-roi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.vision-roi-grid input{width:100%;padding:10px 12px;border:1px solid var(--border,#dfe5ef);border-radius:5px;background:#fafbfd;color:var(--text,#19202f)}@media(max-width:540px){.vision-roi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>
    <div class="page-intro">
      <span class="eyebrow">PROJETO 03 · VISÃO COMPUTACIONAL</span>
      <h1 class="section-title">O movimento vira um evento.</h1>
      <p class="muted">Compare imagens consecutivas e acompanhe movimento dentro de uma área restrita. Use a cena de exemplo, uma câmera ou um vídeo do seu computador.</p>
    </div>

    <div class="notice">Esta demonstração analisa diferenças entre pixels. Ela detecta movimento na região marcada; não reconhece pessoas, equipamentos ou EPIs.</div>

    <section class="panel" style="margin-top:20px">
      <div class="panel-header">
        <div><span class="eyebrow">MONITOR DE CONFORMIDADE</span><h2>Área em observação</h2></div>
        <span class="badge" data-role="source-badge">Cena simulada</span>
      </div>
      <div class="split-grid" style="margin-bottom:18px">
        <label class="field"><span class="field-label">Fonte das imagens</span>
          <select data-role="source"><option value="scene">Cena animada de exemplo</option><option value="camera">Câmera do dispositivo</option><option value="video">Vídeo local</option></select>
        </label>
        <label class="field" data-role="file-field" hidden><span class="field-label">Selecione um vídeo</span><input data-role="file" type="file" accept="video/*"><span class="muted" data-role="file-name">O arquivo é processado neste navegador, sem envio.</span></label>
        <div class="field" data-role="source-note"><span class="field-label">Sobre esta fonte</span><span class="muted" data-role="source-description">Cena gerada por desenho. Os quadros simulados são analisados de verdade.</span></div>
      </div>

      <div style="position:relative;border-radius:16px;overflow:hidden;background:#071c25">
        <canvas data-role="canvas" width="960" height="540" aria-label="Monitor de movimento. A área restrita é marcada por um retângulo." aria-describedby="vision-roi-help" style="display:block;width:100%;height:auto;aspect-ratio:16/9;touch-action:none;cursor:crosshair"></canvas>
      </div>
      <p class="muted" id="vision-roi-help" style="margin:10px 0 18px">Arraste sobre a imagem ou use os campos abaixo para definir a área restrita. X e Y partem do canto superior esquerdo. <button class="button ghost" data-role="roi-reset" type="button">Restaurar área</button></p>
      <fieldset class="vision-roi-controls"><legend class="field-label" style="margin-bottom:12px">Área restrita em porcentagem da imagem</legend><div class="vision-roi-grid">
        <label class="field"><span class="field-label">Posição X (%)</span><input data-role="roi-x" type="number" min="0" max="96" step="0.1" value="57"></label>
        <label class="field"><span class="field-label">Posição Y (%)</span><input data-role="roi-y" type="number" min="0" max="96" step="0.1" value="22"></label>
        <label class="field"><span class="field-label">Largura (%)</span><input data-role="roi-w" type="number" min="4" max="43" step="0.1" value="32"></label>
        <label class="field"><span class="field-label">Altura (%)</span><input data-role="roi-h" type="number" min="4" max="78" step="0.1" value="60"></label>
      </div></fieldset>

      <div class="split-grid">
        <label class="field"><span class="field-label">Sensibilidade <output data-role="sensitivity-value">65%</output></span><input data-role="sensitivity" type="range" min="1" max="100" value="65"><span class="muted">Quanto maior, menores variações de brilho são consideradas.</span></label>
        <label class="field"><span class="field-label">Limiar do alerta <output data-role="threshold-value">2,5%</output></span><input data-role="threshold" type="range" min="0.5" max="20" step="0.5" value="2.5"><span class="muted">Proporção mínima de pixels alterados dentro da área.</span></label>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><button class="button primary" type="button" data-role="start">Iniciar análise</button><button class="button ghost" type="button" data-role="stop" disabled>Parar análise</button></div>
      <p class="status-line" data-role="status" role="status" aria-live="polite">Pronto para iniciar. Nenhuma câmera foi acessada.</p>
      <p class="error" data-role="error" role="alert" hidden></p>
      <video data-role="video" muted playsinline preload="metadata" style="display:none" aria-hidden="true"></video>
    </section>

    <div class="metric-grid" style="margin-top:20px">
      <div class="metric"><span class="muted">Pixels com movimento</span><strong data-role="ratio">0,0%</strong><span class="muted">dentro da área restrita</span></div>
      <div class="metric"><span class="muted">Estado da área</span><strong data-role="state">Parada</strong><span class="muted" data-role="state-detail">Aguardando início</span></div>
      <div class="metric"><span class="muted">Eventos registrados</span><strong data-role="event-count">0</strong><span class="muted">confirmação após 300 ms</span></div>
    </div>

    <section class="panel" style="margin-top:20px">
      <div class="panel-header"><div><span class="eyebrow">RASTREABILIDADE</span><h2>Registro de eventos</h2></div><button class="button ghost" data-role="clear" type="button">Limpar eventos</button></div>
      <p class="muted">Um evento por episódio de movimento. Um novo alerta é liberado após um segundo sem movimento. São exibidos os 50 eventos mais recentes.</p>
      <div class="table-wrap"><table style="width:100%"><thead><tr><th scope="col">Horário</th><th scope="col">Fonte</th><th scope="col">Pixels alterados</th></tr></thead><tbody data-role="events"><tr><td colspan="3" class="empty">Nenhum evento registrado. Inicie a análise para acompanhar.</td></tr></tbody></table></div>
    </section>

    <section class="panel" style="margin-top:20px"><h2>Como a análise funciona</h2><p class="muted">A cada 100 ms, dois quadros de 160 × 90 pixels são comparados. Diferenças de brilho acima da sensibilidade configurada contam como movimento. O alerta usa apenas os pixels da região selecionada.</p><p class="muted">Mudanças na iluminação ou movimento da câmera também podem gerar alertas. A câmera é solicitada somente ao iniciar essa fonte; os vídeos locais e suas imagens permanecem no dispositivo.</p></section>
  `;

  const el = (name) => container.querySelector(`[data-role="${name}"]`);
  const canvas = el('canvas');
  const ctx = canvas.getContext('2d');
  const video = el('video');
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = canvas.width;
  sourceCanvas.height = canvas.height;
  const sourceCtx = sourceCanvas.getContext('2d');
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 160;
  sampleCanvas.height = 90;
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  const defaultROI = { x: 0.57, y: 0.22, w: 0.32, h: 0.60 };
  let roi = { ...defaultROI };
  let draftROI = null;
  let dragStart = null;
  let running = false;
  let starting = false;
  let destroyed = false;
  let raf = 0;
  let operation = 0;
  let stream = null;
  let removeCameraEndListeners = () => {};
  let objectURL = null;
  let previousFrame = null;
  let lastSample = -Infinity;
  let lastTick = 0;
  let sceneTime = 0;
  let movementRatio = 0;
  let movement = false;
  let movementSince = null;
  let quietSince = null;
  let episodeRecorded = false;
  let totalEvents = 0;
  const events = [];
  const listeners = [];
  const pendingWaits = new Set();

  const listen = (node, event, callback, options) => {
    node.addEventListener(event, callback, options);
    listeners.push(() => node.removeEventListener(event, callback, options));
  };
  const number = (value) => value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const sourceName = () => ({ scene: 'Cena simulada', camera: 'Câmera', video: 'Vídeo local' })[el('source').value];
  const setStatus = (message) => { el('status').textContent = message; };
  const setError = (message = '') => { el('error').textContent = message; el('error').hidden = !message; };
  const updateButtons = () => {
    el('start').disabled = running || starting;
    el('stop').disabled = !running && !starting;
    el('start').textContent = starting ? 'Preparando fonte…' : 'Iniciar análise';
  };

  function syncROIInputs() {
    for (const key of ['x', 'y', 'w', 'h']) el(`roi-${key}`).value = String(Number((roi[key] * 100).toFixed(1)));
    el('roi-w').max = String(Number(((1 - roi.x) * 100).toFixed(1)));
    el('roi-h').max = String(Number(((1 - roi.y) * 100).toFixed(1)));
  }

  function resetComparison() {
    previousFrame = null;
    lastSample = -Infinity;
    movementRatio = 0;
    movement = false;
    movementSince = null;
    quietSince = null;
    episodeRecorded = false;
    updateMetrics();
  }

  function updateMetrics() {
    el('ratio').textContent = `${number(movementRatio)}%`;
    el('state').textContent = !running ? 'Parada' : movement ? 'Movimento' : 'Em observação';
    el('state-detail').textContent = !running ? 'Aguardando início' : movement ? 'Limiar de movimento atingido' : 'Abaixo do limiar configurado';
    el('event-count').textContent = String(totalEvents);
  }

  function renderEvents() {
    const body = el('events');
    body.replaceChildren();
    if (!events.length) {
      const row = body.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 3;
      cell.className = 'empty';
      cell.textContent = 'Nenhum evento registrado. Inicie a análise para acompanhar.';
      return;
    }
    for (const event of events) {
      const row = body.insertRow();
      for (const value of [event.time, event.source, `${number(event.ratio)}%`]) row.insertCell().textContent = value;
    }
  }

  function recordEvent() {
    totalEvents += 1;
    events.unshift({
      time: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
      source: sourceName(),
      ratio: movementRatio,
    });
    events.splice(50);
    renderEvents();
    setStatus(`Movimento registrado às ${events[0].time} na área restrita. Fonte: ${sourceName().toLowerCase()}.`);
  }

  function drawScene() {
    const g = sourceCtx;
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    g.fillStyle = '#071c25';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#123440';
    g.lineWidth = 1;
    for (let x = 0; x <= w; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#102e39';
    g.fillRect(52, 96, 180, 100);
    g.fillRect(52, 354, 180, 100);
    g.fillStyle = '#537683';
    g.font = '15px system-ui, sans-serif';
    g.fillText('CENA SINTÉTICA', 66, 124);
    g.fillText('Objetos geométricos', 66, 380);
    g.fillText('em movimento', 66, 402);
    g.strokeStyle = '#205160';
    g.setLineDash([12, 12]);
    g.beginPath(); g.moveTo(38, 275); g.lineTo(w - 38, 275); g.stroke();
    g.setLineDash([]);
    // The synthetic source supplies real image frames; detection never reads these coordinates.
    const x = 260 + ((sceneTime * 150) % 610);
    g.fillStyle = '#5fe5dc';
    g.fillRect(x, 245, 82, 100);
    g.fillStyle = '#d0fff5';
    g.fillRect(x + 12, 258, 58, 9);
    g.fillStyle = '#315f6e';
    g.fillRect(925 - ((sceneTime * 92) % 620), 140, 50, 54);
  }

  function drawVideoFrame() {
    sourceCtx.fillStyle = '#071c25';
    sourceCtx.fillRect(0, 0, canvas.width, canvas.height);
    if (video.readyState < 2 || !video.videoWidth) return;
    const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
    const w = video.videoWidth * scale;
    const h = video.videoHeight * scale;
    sourceCtx.drawImage(video, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }

  function drawDisplay() {
    ctx.drawImage(sourceCanvas, 0, 0);
    const area = draftROI || roi;
    const x = area.x * canvas.width;
    const y = area.y * canvas.height;
    const w = area.w * canvas.width;
    const h = area.h * canvas.height;
    const color = movement && running ? '#ffbd75' : '#57e6d6';
    ctx.fillStyle = movement && running ? 'rgba(255,189,117,.12)' : 'rgba(87,230,214,.055)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash(draftROI ? [9, 6] : []);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.font = '600 14px system-ui, sans-serif';
    const label = movement && running ? 'MOVIMENTO NA ÁREA' : 'ÁREA RESTRITA';
    const labelWidth = ctx.measureText(label).width + 22;
    const labelY = y >= 34 ? y - 30 : y + 4;
    ctx.fillStyle = color;
    ctx.fillRect(x, labelY, labelWidth, 27);
    ctx.fillStyle = '#071c25';
    ctx.fillText(label, x + 11, labelY + 19);
    ctx.fillStyle = 'rgba(3,17,23,.82)';
    ctx.fillRect(18, canvas.height - 43, 278, 28);
    ctx.fillStyle = '#b6d8e0';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`${sourceName().toUpperCase()} · ${running ? 'ANÁLISE ATIVA' : 'ANÁLISE PARADA'}`, 30, canvas.height - 24);
  }

  function compareFrames(now) {
    sampleCtx.drawImage(sourceCanvas, 0, 0, sampleCanvas.width, sampleCanvas.height);
    const current = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
    if (previousFrame) {
      const pixelThreshold = 70 - Number(el('sensitivity').value) * 0.58;
      movementRatio = calculateMotion(current, previousFrame, sampleCanvas.width, sampleCanvas.height, roi, pixelThreshold);
      movement = movementRatio >= Number(el('threshold').value);
      if (movement) {
        quietSince = null;
        if (movementSince === null) movementSince = now;
        if (!episodeRecorded && now - movementSince >= 300) {
          episodeRecorded = true;
          recordEvent();
        }
      } else {
        movementSince = null;
        if (quietSince === null) quietSince = now;
        if (now - quietSince >= 1000) episodeRecorded = false;
      }
      updateMetrics();
    }
    previousFrame = current;
  }

  function frame(now) {
    if (!running || destroyed) return;
    const delta = lastTick ? Math.min((now - lastTick) / 1000, 0.15) : 0;
    lastTick = now;
    if (el('source').value === 'scene') {
      sceneTime += delta;
      drawScene();
    } else drawVideoFrame();
    if (now - lastSample >= 100 && !draftROI) {
      lastSample = now;
      compareFrames(now);
    }
    drawDisplay();
    raf = requestAnimationFrame(frame);
  }

  function releaseCamera() {
    removeCameraEndListeners();
    removeCameraEndListeners = () => {};
    const previousStream = stream;
    stream = null;
    if (previousStream) previousStream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  }

  function stop(message = 'Análise parada. Você pode iniciar novamente.') {
    operation += 1;
    running = false;
    starting = false;
    cancelAnimationFrame(raf);
    raf = 0;
    for (const cancel of [...pendingWaits]) cancel();
    video.pause();
    releaseCamera();
    resetComparison();
    updateButtons();
    setStatus(message);
    drawDisplay();
  }

  function waitForVideo() {
    if (video.readyState >= 2) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let timer;
      const finish = (error) => {
        clearTimeout(timer);
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('error', onError);
        pendingWaits.delete(cancel);
        if (error) reject(error); else resolve();
      };
      const onReady = () => finish();
      const onError = () => finish(new Error('video-unavailable'));
      const cancel = () => finish(new Error('cancelled'));
      pendingWaits.add(cancel);
      video.addEventListener('loadeddata', onReady, { once: true });
      video.addEventListener('error', onError, { once: true });
      timer = setTimeout(() => finish(new Error('video-timeout')), 15000);
    });
  }

  async function start() {
    if (running || starting || destroyed) return;
    setError();
    const selected = el('source').value;
    if (selected === 'video' && !objectURL) {
      setError('Selecione um arquivo de vídeo antes de iniciar.');
      return;
    }
    const currentOperation = ++operation;
    starting = true;
    updateButtons();
    setStatus(selected === 'camera' ? 'Aguardando sua permissão para acessar a câmera…' : 'Preparando os quadros para análise…');
    try {
      if (selected === 'camera') {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('camera-unavailable');
        const camera = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: { ideal: 'environment' } }, audio: false });
        if (destroyed || currentOperation !== operation) { camera.getTracks().forEach((track) => track.stop()); return; }
        stream = camera;
        removeCameraEndListeners = observeCameraEnd(camera, () => {
          if (destroyed || stream !== camera) return;
          stop('A câmera foi desconectada ou teve o acesso encerrado.');
          setError('A imagem da câmera foi interrompida. Conecte a câmera novamente e clique em iniciar, ou escolha outra fonte.');
        });
        video.removeAttribute('src');
        video.srcObject = camera;
        await video.play();
      } else if (selected === 'video') {
        if (video.src !== objectURL) { video.src = objectURL; video.load(); }
        if (video.ended) video.currentTime = 0;
        await waitForVideo();
        if (destroyed || currentOperation !== operation) return;
        await video.play();
      }
      if (destroyed || currentOperation !== operation) return;
      starting = false;
      running = true;
      lastTick = 0;
      resetComparison();
      updateButtons();
      setStatus(selected === 'scene' ? 'Analisando quadros da cena simulada. Arraste para mudar a área restrita.' : `Analisando ${selected === 'camera' ? 'a câmera' : 'o vídeo local'} neste navegador. As imagens não são enviadas.`);
      raf = requestAnimationFrame(frame);
    } catch (error) {
      if (destroyed || currentOperation !== operation) return;
      stop('Não foi possível iniciar esta fonte.');
      if (selected === 'camera') {
        const denied = ['NotAllowedError', 'PermissionDeniedError'].includes(error.name);
        const absent = ['NotFoundError', 'DevicesNotFoundError'].includes(error.name);
        setError(denied ? 'O acesso à câmera não foi autorizado. Você pode permitir o acesso nas configurações do navegador ou escolher a cena de exemplo.' : absent ? 'Nenhuma câmera disponível foi encontrada. Experimente um vídeo local ou a cena de exemplo.' : 'Não foi possível abrir a câmera. Verifique se ela está disponível e se esta página foi aberta em HTTPS ou localhost.');
      } else setError('Não foi possível reproduzir este vídeo. Experimente um arquivo MP4 ou WebM compatível com seu navegador.');
    }
  }

  listen(el('start'), 'click', start);
  listen(el('stop'), 'click', () => stop());
  listen(el('source'), 'change', () => {
    stop('Fonte alterada. Clique em iniciar para analisar.');
    setError();
    const selected = el('source').value;
    el('file-field').hidden = selected !== 'video';
    el('source-note').hidden = selected === 'video';
    el('source-badge').textContent = sourceName();
    el('source-description').textContent = selected === 'camera' ? 'A câmera será solicitada somente ao clicar em iniciar. Imagens processadas no dispositivo.' : 'Cena gerada por desenho. Os quadros simulados são analisados de verdade.';
    if (selected === 'scene') drawScene();
    else {
      sourceCtx.fillStyle = '#071c25'; sourceCtx.fillRect(0, 0, canvas.width, canvas.height);
      sourceCtx.fillStyle = '#93b9c4'; sourceCtx.textAlign = 'center'; sourceCtx.font = '20px system-ui, sans-serif';
      sourceCtx.fillText(selected === 'camera' ? 'Inicie para abrir a câmera' : 'Selecione um vídeo e inicie a análise', canvas.width / 2, canvas.height / 2);
      sourceCtx.textAlign = 'start';
    }
    drawDisplay();
  });
  listen(el('file'), 'change', () => {
    stop('Vídeo selecionado. Clique em iniciar para analisar.');
    setError();
    video.removeAttribute('src');
    video.load();
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = null;
    const file = el('file').files[0];
    if (file) {
      objectURL = URL.createObjectURL(file);
      el('file-name').textContent = `${file.name} · processado localmente, sem envio.`;
    } else el('file-name').textContent = 'O arquivo é processado neste navegador, sem envio.';
  });
  listen(video, 'ended', () => { if (running && el('source').value === 'video') stop('Fim do vídeo. Inicie novamente para analisar desde o começo.'); });
  listen(video, 'error', () => {
    if (running && el('source').value === 'video') {
      stop('A reprodução do vídeo foi interrompida.');
      setError('O navegador não conseguiu continuar a reprodução. Experimente outro arquivo de vídeo.');
    }
  });
  listen(el('sensitivity'), 'input', () => {
    el('sensitivity-value').value = `${el('sensitivity').value}%`;
    resetComparison();
  });
  listen(el('threshold'), 'input', () => {
    el('threshold-value').value = `${number(Number(el('threshold').value))}%`;
    resetComparison();
  });
  listen(el('clear'), 'click', () => {
    totalEvents = 0;
    events.length = 0;
    renderEvents();
    updateMetrics();
    setStatus('Registro de eventos limpo.');
  });
  listen(el('roi-reset'), 'click', () => { roi = { ...defaultROI }; syncROIInputs(); resetComparison(); drawDisplay(); });
  for (const key of ['x', 'y', 'w', 'h']) {
    listen(el(`roi-${key}`), 'change', () => {
      const input = el(`roi-${key}`);
      const value = input.value.trim() === '' ? NaN : Number(input.value);
      if (Number.isFinite(value)) roi = constrainROI({ ...roi, [key]: value / 100 });
      draftROI = null;
      dragStart = null;
      syncROIInputs();
      resetComparison();
      drawDisplay();
      setStatus(`Área restrita: posição ${el('roi-x').value}% por ${el('roi-y').value}%; largura ${el('roi-w').value}% e altura ${el('roi-h').value}%.`);
    });
  }

  const point = (event) => {
    const bounds = canvas.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) };
  };
  listen(canvas, 'pointerdown', (event) => {
    if (event.button !== 0) return;
    dragStart = point(event);
    draftROI = { x: dragStart.x, y: dragStart.y, w: 0, h: 0 };
    canvas.setPointerCapture(event.pointerId);
    drawDisplay();
  });
  listen(canvas, 'pointermove', (event) => {
    if (!dragStart) return;
    const current = point(event);
    draftROI = { x: Math.min(current.x, dragStart.x), y: Math.min(current.y, dragStart.y), w: Math.abs(current.x - dragStart.x), h: Math.abs(current.y - dragStart.y) };
    drawDisplay();
  });
  const finishDrag = (event) => {
    if (!dragStart) return;
    if (event.type !== 'pointercancel' && draftROI && draftROI.w >= 0.04 && draftROI.h >= 0.04) roi = { ...draftROI };
    draftROI = null;
    dragStart = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    resetComparison();
    syncROIInputs();
    drawDisplay();
  };
  listen(canvas, 'pointerup', finishDrag);
  listen(canvas, 'pointercancel', finishDrag);

  syncROIInputs();
  drawScene();
  drawDisplay();
  updateButtons();
  return () => {
    destroyed = true;
    stop();
    listeners.forEach((remove) => remove());
    video.removeAttribute('src');
    video.load();
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = null;
  };
}
