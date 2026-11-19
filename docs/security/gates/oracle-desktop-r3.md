<!-- Parecer emitido pelo Security Engineer Agent (revisor independente). Registrado sem alterar o veredito. -->
# Parecer: Gate de código — Oracle Desktop, Fase 6 (empacotamento e atualização), rodada 3
Veredito: **APROVADO**, com duas pendências MEDIA a tratar antes da próxima publicação.
Data: 2026-11-18

Não há achado CRITICA ou ALTA aberto. Os fuses foram conferidos no binário empacotado, e o GD-16 está VALIDADO.

## Evidências
**Desktop**
- `npx tsc --noEmit`: exit 0.
- `npm test`: 34 de 34.
- `npm audit --omit=dev`: 0 vulnerabilidades. As 6 moderadas restantes são só de build (`minimatch`, via electron-builder).

**Fuses** de `release/win-unpacked/Oracle.exe`, lidos com `@electron/fuses`:
- **Desligados:** RunAsNode, NODE_OPTIONS, `--inspect`, V8 snapshot específico e privilégios extras de `file:`.
- **Ligados:** cifra de cookies, integridade do asar e `OnlyLoadAppFromAsar`.

**Outras verificações**
- Nenhum `ELECTRON_RUN_AS_NODE` no código.
- `app-update.yml` sem `publisherName`: o electron-updater não verifica a assinatura do instalador.
- Nenhum `.env`, `.pem` ou `.key` no pacote.
- `build/api`: 18 vulnerabilidades (1 crítica em `proxy-addr`; altas herdadas do GB-09), que agora vão dentro do instalador.
- GD-17 conferido: `search_path` fixo e funções qualificadas; aspas duplas tratadas; `SET` por lista exata.

## Revalidação
| GD | Status | Evidência |
|---|---|---|
| GD-16 | VALIDADO | Fuses no binário; `migracoes.ts`; seed pelo executor em `utilityProcess`; interface dentro do asar. |
| GD-17 | VALIDADO (resíduo no GD-27) | `postgres.ts:160,165`; `importacao.ts:134-180`. |
| GD-18, GD-19 | ABERTO | Sem mudança. |
| GD-20 | VALIDADO | `frame-src https: oracle-previa:`; iframe com CSP `sandbox` sem `allow-same-origin`; permissões negadas para origem opaca. |

## Achados novos
| ID | Severidade | Título | Correção recomendada |
|---|---|---|---|
| GD-21 | MEDIA | Atualização automática sem verificação de autenticidade: quem publica uma release no GitHub executa código em todos os Oracles instalados. O `autoInstallOnAppQuit` instala mesmo se você escolheu "Depois". | Opção (a): certificado e `publisherName`. Opção (b): assinatura própria Ed25519 do instalador, com a chave pública dentro do asar, verificada antes de instalar, e `autoInstallOnAppQuit = false`. Nos dois casos: 2FA com chave física e token fine-grained. |
| GD-22 | MEDIA | O `GH_TOKEN` fica no ambiente de todo o build (npm install com scripts, dotnet, testes). Um `postinstall` malicioso o rouba e publica uma release, em cadeia com o GD-21. | Ambiente sem token em todas as etapas. Publicação isolada, só com o artefato pronto. `npm ci` e `--ignore-scripts` onde possível. |
| GD-23 | BAIXA | Build da API não reprodutível (`npm install` sobre `package.json` reescrito) e sem auditoria. | Lock enxuto mais `npm ci`. Gate de auditoria crítica no build. Corrigir `proxy-addr`. |
| GD-24 | INFO | A integridade do asar não cobre `resources/api`, `app.asar.unpacked` nem `resources/agente`, que ficam numa pasta gravável pelo próprio usuário. | Aceito pelo T16. Se um dia a instalação for por máquina ou o app passar a ser assinado, verificar um manifesto de hashes. |
| GD-25 | INFO | `--sair` encerra o app a pedido de qualquer processo do mesmo usuário. | Aceito (T16); não é alcançável por deep link. |
| GD-26 | INFO | Só as três flags de depuração remota são recusadas. `--proxy-server`, `--ignore-certificate-errors` e `--no-sandbox` continuam aceitas. | Recusar também essas flags no app empacotado. |
| GD-27 | INFO | `SET CLIENT_ENCODING = ''` aceita qualquer encoding (o literal é normalizado). | Aceitar só `'UTF8'`, conferindo o texto cru. |
| GD-28 | INFO | Releases públicos exigem repositório público; `docs/security/` fica visível. | Decisão do dono. Sugestão: um repositório separado só de releases, com token restrito a ele. |

## Condições
1. GD-16 e GD-20 VALIDADO.
2. Registrar GD-21 a GD-28.
3. Antes da próxima publicação: corrigir o GD-22 e aplicar ao menos a proteção de conta e token do GD-21. Sem isso, publicar só o instalador manual.
4. Tratar a crítica `proxy-addr` antes de distribuir.
