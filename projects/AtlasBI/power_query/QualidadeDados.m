#table(type table [Metrica = text, Valor = Int64.Type], {
    {"Linhas originais", Table.RowCount(stgVendas)},
    {"Linhas inválidas", Table.RowCount(stgVendas) - Table.RowCount(vendasValidas)},
    {"IDs duplicados", Table.RowCount(vendasValidas) - Table.RowCount(Table.Distinct(vendasValidas, {"ItemID"}))},
    {"Linhas carregadas", Table.RowCount(FatoVendas)}
})
