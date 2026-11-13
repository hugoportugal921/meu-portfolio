Table.TransformColumnTypes(fxLerCsv("Metas"), {{"DataMeta", type date}, {"UnidadeID", Int64.Type}, {"MetaReceita", Currency.Type}}, "en-US")
