let
    SemDuplicados = Table.Distinct(vendasValidas, {"ItemID"}),
    Receita = Table.AddColumn(SemDuplicados, "ReceitaLiquida", each [Quantidade] * [PrecoUnitario] - [Desconto], Currency.Type),
    Custo = Table.AddColumn(Receita, "CustoTotal", each [Quantidade] * [CustoUnitario], Currency.Type)
in
    Custo
