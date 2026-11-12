# Registro de achados de segurança: controle do computador

Mantido a partir dos pareceres do Security Engineer Agent (`gates/`). Formato de cada linha:
`| ID | Severidade | Status | Título | Origem | Correção |`

- Severidade: `CRITICA`, `ALTA`, `MEDIA`, `BAIXA`, `INFO`.
- Status: `ABERTO`, `VALIDADO` (aguardando revalidação), `VALIDADO` (o revisor confirmou a correção), `ACEITO` (risco aceito com justificativa).

**Regra de liberação (SR-51):** qualquer linha `CRITICA` ou `ALTA` com status `ABERTO` ou `VALIDADO` impede `DESKTOP_ATIVO` e bloqueia a fase seguinte.

| ID | Severidade | Status | Título | Origem | Correção |
|---|---|---|---|---|---|
| GA-01 | ALTA | VALIDADO | Contaminação do SR-06 incompleta (memória e especialistas) e exfiltração por `abrir_url` | gates/fase-1-arquitetura-r1 | SR-06 invertido (allowlist de ferramentas limpas, calculada no banco), SR-06a |
| GA-02 | ALTA | VALIDADO | `abrir_documento` com lista de bloqueio de extensões | gates/fase-1-arquitetura-r1 | SR-12a (allowlist; o resto é bloqueado; mover não troca a extensão) |
| GA-03 | ALTA | VALIDADO | Sem prova nem consumo da aprovação no gateway; validade de 24h | gates/fase-1-arquitetura-r1 | SR-07 revisado (`ctx.execucao`, checagem transacional, `aprovacaoId @unique`, 10 min) |
| GA-04 | MEDIA | VALIDADO | Caminho moderado depende do gateway | gates/fase-1-arquitetura-r1 | SR-09 (a)–(d) |
| GA-05 | MEDIA | VALIDADO | Corpo cru indisponível; limite de 25 MB | gates/fase-1-arquitetura-r1 | SR-26 |
| GA-06 | MEDIA | VALIDADO | Comando sem vínculo ao dispositivo e sem separação de domínio | gates/fase-1-arquitetura-r1 | SR-27 |
| GA-07 | MEDIA | VALIDADO | Pareamento TOFU | gates/fase-1-arquitetura-r1 | SR-28, T24 |
| GA-08 | MEDIA | VALIDADO | Timeout ou queda ambíguos | gates/fase-1-arquitetura-r1 | SR-29, T27 |
| GA-09 | MEDIA | VALIDADO | `.lnk` com argumentos ou alvo LOLBin no inventário | gates/fase-1-arquitetura-r1 | SR-11a |
| GA-10 | MEDIA | VALIDADO | Voz fora do threat model | gates/fase-1-arquitetura-r1 | E8, T26, SR-06b |
| GA-11 | MEDIA | VALIDADO | JWT roubado vira controle do desktop | gates/fase-1-arquitetura-r1 | SR-35 (ampliações confirmadas localmente). Reautenticação para aprovar risco alto fica como risco residual aceito até a Fase 4 (T25) |
| GA-12 | BAIXA | VALIDADO | `abrir_url` sem normalização | gates/fase-1-arquitetura-r1 | SR-37 |
| GA-13 | INFO | VALIDADO | Fila e nonces em memória | gates/fase-1-arquitetura-r1 | SR-36 |
| GA-14 | MEDIA | VALIDADO | Contaminação ignora o histórico e `referencia` | gates/fase-1-arquitetura-r2 | SR-06c (`Execucao.contextoExterno`) |
| GA-15 | MEDIA | VALIDADO | SR-35 incompleto quanto ao que é ampliação | gates/fase-1-arquitetura-r2 | SR-35 revisado |
| GA-16 | BAIXA | VALIDADO | Correspondência de host não especificada | gates/fase-1-arquitetura-r2 | SR-06a revisado |
| GA-17 | BAIXA | VALIDADO | `.doc .xls .ppt .svg` na allowlist | gates/fase-1-arquitetura-r2 | SR-12a revisado: essas quatro são risco alto |
| GB-01 | ALTA | VALIDADO | Pastas proibidas alcançáveis sob diretório autorizado; `mover` sem allowlist | gates/fase-1-3-codigo-r1 | `caminhoProibido`/`CaminhoProibido` aplicados a todos os componentes do alvo (AppData, Startup, ocultos, `~`, `$`); atributos oculto/sistema recusados; `mover` só com allowlist. Testes: jest `GB-01: alvos proibidos…`; xUnit `GB01Tests` |
| GB-02 | MEDIA | VALIDADO | TOCTOU na confirmação local (bandeja) | gates/fase-1-3-codigo-r1 | `Instantaneo()` + `ConfirmarAmpliacao(versaoVista)` sob lock; nome do app no diff. xUnit `GB02_*` |
| GB-03 | MEDIA | VALIDADO | "Pare tudo" ignorado durante execução | gates/fase-1-3-codigo-r1 | `decidirEnvio` antes do guard de `loading` (PromptBar e Panel); wake word ativa durante a busca. `npm run test:unit` |
| GB-04 | BAIXA | VALIDADO | Hash da aprovação não cobre o app resolvido | gates/fase-1-3-codigo-r1 | `enviar(..., vinculo)`: o "Programa: <alvo>" resolvido precisa estar no resumo aprovado. jest `GB-04` |
| GB-05 | BAIXA | VALIDADO | Redação incompleta (estado, resumo, FullName) | gates/fase-1-3-codigo-r1 | Auditoria `aprovacao.solicitada` com a entrada redigida; busca devolve caminho relativo. Resíduo aceito: `AprovacaoAcao.resumo` (o que o usuário aprova) e `Execucao.estado` (necessário para retomar; limpo ao concluir) mantêm os caminhos |
| GB-06 | BAIXA | VALIDADO | TOCTOU validação × operação | gates/fase-1-3-codigo-r1 | `ConferirFinal` (`GetFinalPathNameByHandle`) imediatamente antes de abrir, mover e criar. xUnit `GB06_*`. Resíduo: janela de microssegundos entre conferir e agir |
| GB-07 | BAIXA | VALIDADO | Sem teste do parser cru | gates/fase-1-3-codigo-r1 | `bootstrap-agente.spec.ts` (bytes exatos, mais de 64 KB recusado, rota comum sem corpo cru, text/plain) |
| GB-08 | INFO | VALIDADO | Parar tudo não cancela execuções; risco estático no revisor/auditoria | gates/fase-1-3-codigo-r1 | Execuções paradas com aprovação desktop são canceladas; revisor e auditoria usam `riscoRotulo`. jest `GB-08` |
| GB-09 | INFO | ABERTO | Altos do npm audit pré-existentes na superfície nova | gates/fase-1-3-codigo-r1 | Fora do escopo desta mudança (lockfiles inalterados); proposta como tarefa separada de atualização de dependências |
| GB-10 | INFO | CORRIGIDO | Vínculo do GB-04 por substring; nome do app (do modelo) no resumo poderia imitar "Programa:" | gates/fase-1-3-codigo-r2 | Nome higienizado no resumo (remove "Programa:", aspas, \ e :). Comparação por campo estruturado fica para a Fase 4 |
| GB-11 | INFO | CORRIGIDO | `oracle-agent permissoes` liberava o mutex cedo; diff com hashes | gates/fase-1-3-codigo-r2 | Mutex mantido até o fim; nomes do inventário local no diff |
| GB-12 | INFO | ABERTO | Corpo acima de 64 KB devolve 500 em vez de 413 | gates/fase-1-3-codigo-r2 | Cosmético (o handler não roda) |
