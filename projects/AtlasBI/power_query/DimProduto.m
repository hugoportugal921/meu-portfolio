Table.TransformColumnTypes(fxLerCsv("Produtos"), {{"ProdutoID", Int64.Type}, {"Produto", type text}, {"Categoria", type text}}, "en-US")
