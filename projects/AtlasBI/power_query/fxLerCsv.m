(nome as text) as table =>
let
    Conteudo = Record.Field(Fontes, nome),
    CSV = Csv.Document(Conteudo, [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),
    Cabecalhos = Table.PromoteHeaders(CSV, [PromoteAllScalars=true])
in
    Cabecalhos
