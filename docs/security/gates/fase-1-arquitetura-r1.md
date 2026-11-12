<!-- Parecer emitido pelo Security Engineer Agent (revisor independente). Registrado sem alterar o veredito. -->
# Parecer: Gate A (arquitetura), Fases 1–3, rodada 1
Veredito: **REPROVADO**
Data: 2026-11-12

## Escopo revisado
Plano aprovado, `docs/security/threat-model.md` (T01–T22), `requisitos.md` (SR-01–SR-51) e o código em que o desenho se apoia: `executor.service.ts`, `politica.service.ts`, `revisor.service.ts`, `auditoria.service.ts`, `ferramentas/{registro.service,ferramenta,leitura}.ts`, `bootstrap.ts`, `orquestrador.service.ts` (decidir) e `schema.prisma` (AprovacaoAcao). Ainda não há código da funcionalidade, então não rodei testes nem auditorias.

## Evidências
- O caminho `permitir` roda a ferramenta sem `registrarObrigatorio`, sem claim e sem revisor. Ele audita só depois, com a entrada crua: `detalhes: { entrada: c.entrada }` (executor.service.ts:733-755). A entrada crua também vai para `EtapaExecucao.entrada` (linha 615).
- Nesse mesmo caminho a política avalia antes de existir a entrada normalizada (`avaliar(perfil, pode)`, linha 604), e a execução recebe `c.entrada` crua (linha 735). Só o caminho `aprovar` usa `preparar` (linha 642).
- `avaliar` recebe só `perfil` e `pode`: não vê a entrada nem a contaminação da execução (politica.service.ts:38-47).
- `ContextoFerramenta` não carrega execucaoId, etapaId nem aprovacaoId (ferramenta.ts:19-35). `registro.executar(nome, entrada, ctx)` é o único canal até a ferramenta (executor.service.ts:452).
- `AprovacaoAcao` não tem campo de consumo. Só a etapa tem claim (executor.service.ts:426). A validade é de 24h (`VALIDADE_APROVACAO_MS`, linha 47). A decisão é escopada por `solicitanteId` (orquestrador.service.ts:618), o que está correto.
- Só `buscar_web`, `abrir_pagina` e os conectores têm `dadosExternos`. `buscar_memoria` e `consultar_agente` não têm (leitura.ts:82, 114, 177).
- O `json({ limit: '25mb' })` global parseia o corpo antes de qualquer guard e descarta os bytes crus (bootstrap.ts:27).

## Achados
| ID | Sev. | Título | Local | Correção |
|---|---|---|---|---|
| GA-01 | **ALTA** | A contaminação do SR-06 está incompleta. O conteúdo do Repositório (`buscar_memoria`) e de `consultar_agente` não conta como externo. O cenário E2E do próprio plano passaria por `abrir_url` moderado sem confirmação, e isso é um canal de exfiltração de dados da memória pela query string. | leitura.ts:82,177; SR-06 | Inverter a regra: moderado roda sem confirmação **só** se nenhuma ferramenta devolveu conteúdo na execução, com allowlist explícita de ferramentas "limpas". O gateway recalcula a contaminação a partir das etapas no banco. `abrir_url` sobe para alto quando o domínio não está numa allowlist. Considerar também o histórico da conversa como contaminado. |
| GA-02 | **ALTA** | `abrir_documento` usa ShellExecute com **lista de bloqueio** de extensões. Ficam abertos `.url .library-ms .search-ms .settingcontent-ms .appref-ms .chm .cpl .msc .wsf .jar .iso/.vhd .docm/.xlsm .html`, entre outros. | plano, SR-12 | Usar uma **allowlist** de extensões de documento, com o resto em alto ou bloqueado. Em `mover_arquivo`, proibir a troca da extensão para uma fora da allowlist. |
| GA-03 | **ALTA** | SR-05 e SR-07 não podem ser implementados como estão escritos. O gateway não recebe a prova da aprovação, a aprovação não tem estado de consumido, e uma validade de 24h é longa demais. | ferramenta.ts:19; schema; executor.service.ts:452 | Incluir no `ContextoFerramenta` um campo `execucao: {id, etapaId, aprovacaoId?}` preenchido só pelo executor, com esquemas zod `.strict()`. Numa transação, o gateway confere: aprovação `aprovada`, mesma empresa, solicitante, execução, etapa e ferramenta, `expiraEm > agora`, hash igual, e risco aprovado ≥ risco atual. `ComandoDesktop.aprovacaoId @unique`. Validade de no máximo 10 min. |
| GA-04 | MEDIA | O caminho moderado sem aprovação depende inteiramente do gateway. | executor.service.ts:600-755 | (a) o gateway é o único caminho até o agente; (b) o risco é calculado sobre a entrada validada e essa mesma entrada é executada; (c) `registrarObrigatorio` e o insert de `ComandoDesktop` ocorrem na mesma transação, com etapaId; (d) para `desktop_*`, não gravar a entrada crua em `detalhes` nem em `EtapaExecucao.entrada`. |
| GA-05 | MEDIA | O corpo assinado não está disponível: o parse acontece antes da verificação, e rotas sem autenticação aceitam 25 MB. | bootstrap.ts:27 | `rawBody` (`json({verify})`) e um limite de 64 KB em `/desktop/agente/*`. O caminho assinado inclui a query string. |
| GA-06 | MEDIA | O comando não está amarrado ao dispositivo nem tem separação de domínio. | SR-20/21 | Incluir `dispositivoId`, `tipo` e `versaoPolitica` nos bytes assinados. |
| GA-07 | MEDIA | O pareamento é TOFU: com `pair --api <url do atacante>`, o agente passa a obedecer outro servidor. | SR-23 | Impressão digital da chave na UI e no agente, com confirmação local e do dono antes de o dispositivo ficar `conectado`. |
| GA-08 | MEDIA | Um timeout ou uma queda geram resultado ambíguo e possível duplicação. | gateway | Depois do timeout, devolver "estado desconhecido, não repita". O agente não inicia nada depois de `expiraEm`. No boot da API, os comandos pendentes viram `interrompido`. O agente rejeita comandos emitidos antes de ter iniciado. |
| GA-09 | MEDIA | O inventário por atalho do Menu Iniciar aceita `.lnk` com argumentos ou com alvo LOLBin. | SR-11/12 | Resolver o alvo do `.lnk`, rejeitar atalhos com argumentos ou alvo bloqueado, e mostrar o caminho do alvo na aprovação. |
| GA-10 | MEDIA | O threat model não cobre a entrada por voz (wake word). | threat-model §3 | Novo ponto de entrada E8. Pedidos por voz pedem confirmação até no risco moderado. |
| GA-11 | MEDIA | Um JWT roubado vira controle do desktop. A política local só é independente na lista de bloqueio. | §5 | Afrouxar diretórios ou apps exige confirmação local. Reautenticação para aprovar risco alto. |
| GA-12 | BAIXA | `abrir_url`: sem normalização, há risco de injeção de argumentos no navegador. | plano | Normalizar com `Uri` e recusar espaço, aspas e caracteres de controle. |
| GA-13 | INFO | A fila e os nonces em memória não servem para serverless. | gateway | O banco é a fonte da verdade. `DESKTOP_ATIVO=false` em deploy Vercel. |

## Condições para aprovação
1. Corrigir GA-01, GA-02 e GA-03 em `requisitos.md` e no plano.
2. Escrever as condições (a)–(d) do GA-04 e as correções de GA-05, GA-06 e GA-08 como requisitos SR novos, com testes nomeados.
3. Atualizar o threat model com voz (GA-10), pareamento TOFU (GA-07) e conta comprometida (GA-11).
4. Registrar GA-01 a GA-13 em `docs/security/achados.md`.
