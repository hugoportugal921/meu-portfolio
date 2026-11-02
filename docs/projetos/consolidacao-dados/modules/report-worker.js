export const COLUMNS = ['id', 'date', 'unit', 'category', 'status', 'amount', 'duration'];
const STATUSES = new Set(['Concluído', 'Em andamento', 'Pendente']);

function delimiterFor(text) {
  let quoted = false, commas = 0, semicolons = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (c === '\n' || c === '\r') break;
      if (c === ',') commas++;
      if (c === ';') semicolons++;
    }
  }
  return semicolons > commas ? ';' : ',';
}

export function parseCSV(input) {
  const text = String(input).replace(/^\uFEFF/, '');
  const delimiter = delimiterFor(text);
  const records = [];
  let fields = [], value = '', quoted = false, afterQuote = false;
  let line = 1, recordLine = 1;
  const pushField = () => { fields.push(value); value = ''; afterQuote = false; };
  const pushRecord = () => {
    pushField();
    if (fields.some(field => field.trim() !== '')) records.push({ values: fields, line: recordLine });
    fields = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { value += '"'; i++; }
        else { quoted = false; afterQuote = true; }
      } else {
        value += c;
        if (c === '\n') line++;
        else if (c === '\r' && text[i + 1] !== '\n') line++;
      }
    } else if (c === delimiter) {
      pushField();
    } else if (c === '\r' || c === '\n') {
      pushRecord();
      if (c === '\r' && text[i + 1] === '\n') i++;
      line++;
      recordLine = line;
    } else if (c === '"') {
      if (value.length || afterQuote) throw new Error(`Linha ${line}: aspas em posição inválida.`);
      quoted = true;
    } else if (afterQuote) {
      if (c !== ' ' && c !== '\t') throw new Error(`Linha ${line}: texto após o fechamento de aspas.`);
    } else {
      value += c;
    }
  }
  if (quoted) throw new Error(`Linha ${recordLine}: campo com aspas não foi fechado.`);
  if (fields.length || value.length || afterQuote) pushRecord();
  if (!records.length) throw new Error('O arquivo CSV está vazio.');
  const header = records.shift().values.map(field => field.trim().toLowerCase());
  if (new Set(header).size !== header.length) throw new Error('O cabeçalho contém colunas repetidas.');
  const missing = COLUMNS.filter(column => !header.includes(column));
  if (missing.length) throw new Error(`Colunas obrigatórias ausentes: ${missing.join(', ')}.`);
  if (!records.length) throw new Error('O arquivo contém o cabeçalho, mas não tem registros.');
  if (records.length > 50000) throw new Error('Importe até 50.000 registros por arquivo.');
  return records.map(record => {
    if (record.values.length !== header.length) throw new Error(`Linha ${record.line}: ${record.values.length} campos encontrados; esperado: ${header.length}.`);
    const item = Object.fromEntries(header.map((column, i) => [column, record.values[i].trim()]));
    return { item, line: record.line };
  });
}

function parseNumber(value, field, line) {
  const normalized = value.includes(',') && !value.includes('.') ? value.replace(',', '.') : value;
  if (!normalized || !/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error(`Linha ${line}: ${field} deve ser um número positivo ou zero, sem separador de milhares.`);
  const number = Number(normalized);
  if (!Number.isFinite(number) || number > 1e12) throw new Error(`Linha ${line}: valor de ${field} fora do limite permitido.`);
  return number;
}

export function importRows(text, existingIds = [], progress = () => {}) {
  progress(5, 'Lendo a estrutura do CSV');
  const records = parseCSV(text);
  const knownIds = new Set(existingIds);
  const rows = [];
  let duplicates = 0;
  records.forEach(({ item, line }, index) => {
    for (const field of ['id', 'unit', 'category']) {
      if (!item[field] || item[field].length > 200) throw new Error(`Linha ${line}: ${field} precisa ter entre 1 e 200 caracteres.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !Number.isFinite(Date.parse(item.date + 'T00:00:00Z')) || new Date(item.date + 'T00:00:00Z').toISOString().slice(0, 10) !== item.date) {
      throw new Error(`Linha ${line}: date deve conter uma data válida no formato AAAA-MM-DD.`);
    }
    if (!STATUSES.has(item.status)) throw new Error(`Linha ${line}: status deve ser Concluído, Em andamento ou Pendente.`);
    const row = {
      id: item.id, date: item.date, unit: item.unit, category: item.category, status: item.status,
      amount: parseNumber(item.amount, 'amount', line), duration: parseNumber(item.duration, 'duration', line)
    };
    if (knownIds.has(row.id)) duplicates++;
    else { knownIds.add(row.id); rows.push(row); }
    if (index % 500 === 0) progress(10 + Math.round((index / records.length) * 85), 'Validando e removendo IDs repetidos');
  });
  progress(100, 'Importação validada');
  return { rows, totalRows: records.length, duplicates };
}

function csvField(value, delimiter) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return text.includes(delimiter) || /["\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

export function toCSV(rows, columns = COLUMNS, delimiter = ',') {
  return '\uFEFF' + [columns.join(delimiter), ...rows.map(row => columns.map(column => csvField(row[column], delimiter)).join(delimiter))].join('\r\n');
}

export function consolidateRows(rows, progress = () => {}) {
  const units = new Map();
  rows.forEach((row, index) => {
    const group = units.get(row.unit) || { unidade: row.unit, registros: 0, concluidos: 0, em_andamento: 0, pendentes: 0, valor_total: 0, duracao_total: 0 };
    group.registros++;
    if (row.status === 'Concluído') group.concluidos++;
    if (row.status === 'Em andamento') group.em_andamento++;
    if (row.status === 'Pendente') group.pendentes++;
    group.valor_total += row.amount;
    group.duracao_total += row.duration;
    units.set(row.unit, group);
    if (index % 250 === 0) progress(10 + Math.round(index / Math.max(rows.length, 1) * 80), 'Consolidando indicadores por unidade');
  });
  return [...units.values()].sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR')).map(group => ({
    unidade: group.unidade, registros: group.registros, concluidos: group.concluidos,
    em_andamento: group.em_andamento, pendentes: group.pendentes,
    valor_total: group.valor_total.toFixed(2), duracao_media_min: (group.duracao_total / group.registros).toFixed(2)
  }));
}

if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof document === 'undefined') {
  self.addEventListener('message', event => {
    const { id, type, text, existingIds, rows } = event.data;
    const progress = (value, message) => self.postMessage({ id, kind: 'progress', value, message });
    try {
      progress(1, 'Processamento iniciado');
      let result;
      if (type === 'import') result = importRows(text, existingIds, progress);
      else if (type === 'report') {
        const groups = consolidateRows(rows, progress);
        result = { csv: toCSV(groups, ['unidade', 'registros', 'concluidos', 'em_andamento', 'pendentes', 'valor_total', 'duracao_media_min'], ';'), units: groups.length, count: rows.length };
      } else throw new Error('Tipo de tarefa não reconhecido.');
      self.postMessage({ id, kind: 'done', result });
    } catch (error) {
      self.postMessage({ id, kind: 'error', message: error.message || 'Não foi possível concluir a tarefa.' });
    }
  });
}
