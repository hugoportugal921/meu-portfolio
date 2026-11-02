export function createSample() {
  let seed = 417;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const units = ['São Paulo', 'Curitiba', 'Belo Horizonte', 'Recife'];
  const categories = ['Processamento', 'Atendimento', 'Auditoria', 'Logística'];
  return Array.from({ length: 360 }, (_, i) => {
    const date = new Date(Date.UTC(2026, 8, 18 + Math.floor(i / 8)));
    const value = random();
    return {
      id: `AMOSTRA-${String(i + 1).padStart(4, '0')}`,
      date: date.toISOString().slice(0, 10),
      unit: units[Math.floor(random() * units.length)],
      category: categories[Math.floor(random() * categories.length)],
      status: value < .7 ? 'Concluído' : value < .88 ? 'Em andamento' : 'Pendente',
      amount: Math.round((100 + random() * 2900) * 100) / 100,
      duration: Math.round(8 + random() * 142),
    };
  });
}

export function createStore() {
  let rows = createSample();
  let imported = false;
  const listeners = new Set();
  const emit = () => { for (const listener of listeners) listener(); };
  return {
    getRows: () => rows.map(row => ({ ...row })),
    getSource: () => imported ? 'Base compartilhada: amostra e registros importados' : 'Dados de exemplo simulados',
    setRows(next) { rows = next.map(row => ({ ...row })); imported = true; emit(); },
    appendRows(next) {
      const ids = new Set(rows.map(row => row.id));
      const unique = next.filter(row => { if (ids.has(row.id)) return false; ids.add(row.id); return true; });
      if (unique.some(row => !row.id.startsWith('DEMO-'))) imported = true;
      rows.push(...unique.map(row => ({ ...row })));
      emit();
    },
    resetSample() { rows = createSample(); imported = false; emit(); },
    subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
  };
}
