let
    Fonte = fxLerCsv("Vendas"),
    Textos = Table.TransformColumns(Fonte, {{"ItemID", Text.Trim, type text}, {"PedidoID", Text.Trim, type text}}),
    Tipos = Table.TransformColumns(Textos, {
        {"DataVenda", each try Date.FromText(_, [Format="yyyy-MM-dd", Culture="en-US"]) otherwise null, type nullable date},
        {"ProdutoID", each try Int64.From(Number.FromText(_, "en-US")) otherwise null, Int64.Type},
        {"UnidadeID", each try Int64.From(Number.FromText(_, "en-US")) otherwise null, Int64.Type},
        {"CanalID", each try Int64.From(Number.FromText(_, "en-US")) otherwise null, Int64.Type},
        {"Quantidade", each try Int64.From(Number.FromText(_, "en-US")) otherwise null, Int64.Type},
        {"PrecoUnitario", each try Currency.From(_, "en-US") otherwise null, Currency.Type},
        {"CustoUnitario", each try Currency.From(_, "en-US") otherwise null, Currency.Type},
        {"Desconto", each try Currency.From(_, "en-US") otherwise null, Currency.Type}
    })
in
    Tipos
