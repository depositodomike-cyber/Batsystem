<!-- Parecer emitido pelo Security Engineer Agent (revisor independente). Registrado sem alterar o veredito. -->
# Parecer: Gate B (código), Fases 1–3, rodada 2
Veredito: **APROVADO**. Não há achado CRITICA ou ALTA em aberto.
Data: 2026-11-12

## Evidências
- `npx jest src/desktop src/orquestrador src/acesso`: 261 testes, 260 passaram. A única falha é a esperada (SR-51, registro real ainda com GB-01 `CORRIGIDO`).
- `dotnet test`: 72 aprovados, 0 falhas.
- `npm run test:unit` (demo): 2/2.

## Revalidação
| GB | Status | Observação |
|---|---|---|
| GB-01 | VALIDADO | `caminhoProibido`/`CaminhoProibido` por componente nas duas camadas; Hidden/System recusados; allowlist no `mover`; busca filtrada |
| GB-02 | VALIDADO | Lock + `Instantaneo()` + `ConfirmarAmpliacao(versaoVista)`; nome do app no diff. Pressuposto: o servidor sempre incrementa a versão |
| GB-03 | VALIDADO | `decidirEnvio` antes do `loading`; wake word não pausa na busca |
| GB-04 | VALIDADO com ressalva (GB-10) | Vínculo por substring do resumo |
| GB-05 | VALIDADO | Resíduo documentado (`estado` e `AprovacaoAcao`) |
| GB-06 | VALIDADO | `GetFinalPathNameByHandle` antes de cada ação; resíduo de microssegundos aceito |
| GB-07 | VALIDADO | 4 casos; 500 em vez de 413 é cosmético |
| GB-08 | VALIDADO | Execuções paradas canceladas; `riscoRotulo` no revisor e na auditoria |
| GB-09 | ABERTO (INFO) | Tarefa separada de dependências: `zod` 4.6.6 ou mais, `body-parser`/`platform-express`, `proxy-addr` |

## Achados novos
| ID | Sev. | Título | Correção |
|---|---|---|---|
| GB-10 | INFO | O vínculo do GB-04 é por substring, e o nome do app no resumo vem do modelo: um nome com "Programa: C:\…" embutido falsificaria o texto | Comparar por igualdade de campo; limitar ou escapar o nome no resumo |
| GB-11 | INFO | `oracle-agent permissoes` libera o mutex antes do sync e do `Salvar()`; o diff no console mostra hashes | Manter o mutex até o fim; nomes a partir do inventário local |
| GB-12 | INFO | Corpo acima de 64 KB devolve 500 em vez de 413 | Mapear `entity.too.large` para 413 |
