<!-- Parecer emitido pelo Security Engineer Agent (revisor independente). Registrado sem alterar o veredito. -->
# Parecer: Gate B (código), Fases 1–3, rodada 1
Veredito: **REPROVADO** (1 achado ALTA em aberto: GB-01)
Data: 2026-11-12

## Evidências
- `npx jest src/desktop src/orquestrador src/acesso`: 12 suítes, 252 testes, todos passaram.
- `dotnet test`: 58 aprovados, 0 com falha.
- `dotnet list package --vulnerable`: nenhum pacote vulnerável (nenhuma PackageReference no agente).
- `npm audit --omit=dev`: api com 21 vulnerabilidades (1 crítica em `proxy-addr`), demo com 16. Todas anteriores a esta mudança: os lockfiles estão inalterados.
- Condições do gate A: GA-03 ✔, GA-04 ✔, GA-05 ✔ (sem teste), GA-08 ✔, GA-10 ✔.
- Verificados sem problema:
  - A assinatura é verificada antes do parse.
  - Existe um único `comandoDesktop.create`.
  - A aprovação é conferida numa transação Serializable, com `aprovacaoId @unique`.
  - O risco só sobe.
  - O agente recusa risco inconsistente.
  - Não há shell.
  - Falha fechada.
  - Não há `dangerouslySetInnerHTML`.

## Achados
| ID | Sev. | Título | Local | Correção |
|---|---|---|---|---|
| GB-01 | ALTA | Pastas proibidas (AppData, Startup, .ssh, a pasta do agente, nomes 8.3) ficam alcançáveis sob um diretório pai autorizado; `mover_arquivo` sem allowlist de extensão. Exemplo: `mover x.exe → …\Startup` como moderado, ou mexer em `agent.json` para contornar o SR-35. | risco-desktop.ts:136-146,254-262; Caminhos.cs:52-64; Executor.cs:329-345 | Aplicar a lista proibida a todos os componentes do caminho-alvo; recusar `~`, ocultos e sistema; `mover` com allowlist; testes jest e xUnit |
| GB-02 | MEDIA | TOCTOU na confirmação da bandeja: o "Sim" confirma o `Servidor` atual, não o diff exibido; sem lock | Bandeja.cs, Agente.cs, PoliticaLocal.cs | Snapshot da versão; confirmar só se a versão bater; lock; mostrar o nome do app |
| GB-03 | MEDIA | "Pare tudo" é ignorado durante uma execução, porque o guard de `loading` vem antes | PromptBar `enviar`, Panel.tsx:111 | Testar antes do guard; wake word também com `loading`; teste |
| GB-04 | BAIXA | O hash da aprovação não cobre o app resolvido | ferramentas/desktop.ts; gateway | Vincular o app/alvo aprovado |
| GB-05 | BAIXA | Redação incompleta: estado, resumo da auditoria e `FullName` na busca | executor; orquestrador; Executor.cs:214 | Redigir o resumo na auditoria; caminho relativo; documentar o resíduo |
| GB-06 | BAIXA | TOCTOU entre a validação do caminho e a operação | Executor.cs | Validar o caminho final por handle (`GetFinalPathNameByHandle`) |
| GB-07 | BAIXA | Sem teste do parser cru do bootstrap | bootstrap.ts | Teste com supertest |
| GB-08 | INFO | `pararTudo` não cancela execuções; revisor e auditoria com o risco estático | dispositivos.service.ts; executor | Cancelar as execuções; usar `riscoRotulo` |
| GB-09 | INFO | Altos do `npm audit` já existentes (`zod`, `body-parser`, `proxy-addr` crítica) agora protegem uma superfície nova | lockfiles | Atualizar as dependências |

## Condições
1. Corrigir GB-01, GB-02 e GB-03, com testes.
2. Registrar GB-01 a GB-09.
3. Recomendado antes do gate C: GB-04, GB-05, GB-07 e GB-09.
