<!-- Parecer emitido pelo Security Engineer Agent (revisor independente). Registrado sem alterar o veredito. -->
# Parecer: Gate de código — Oracle Desktop (Electron), Fases 2–5, rodada 2
Veredito: **APROVADO**. Aprovação com condições de registro.
Data: 2026-11-18

- GD-01 a GD-15: correções verificadas no código e nos testes.
- GD-16: continua ABERTO (INFO), para a Fase 6.
- Não há achado CRITICA nem ALTA em aberto.
- Esta rodada encontrou três achados novos: GD-17 (MEDIA), GD-18 (BAIXA) e GD-19 (INFO).

## Evidências
**desktop**
- `npx tsc --noEmit`: exit 0.
- `npm test`: 27 de 27 passaram, em 8 suítes.
- `npm audit --omit=dev`: 0 vulnerabilidades.

**ts/api**
- `npx jest`: 511 de 512 passaram.
- A única falha é `liberacao.spec.ts` (SR-51), causada pelo GD-01 em `CORRIGIDO`. A falha é esperada até a validação.
- `audio-transcrever.spec.ts`: 5 casos.

**Limitação:** o revisor não executa o Electron. O teste de runtime da prévia hostil foi informado pelo implementador. Ele é coerente com `previa.ts`, mas o revisor não o reproduziu.

## Revalidação
| GD | Status confirmado | Observação |
|---|---|---|
| GD-01 | VALIDADO | `doDocumentoPrincipal`, `decidirCheck`/`decidirPedido`, `window.open` sempre negado, `previa.ts` com partição em memória, CSP `sandbox` sem `allow-same-origin`, `connect-src 'none'`. |
| GD-02 | VALIDADO (resíduo no GD-18) | Sem modo externo no app empacotado; porta ocupada resulta em erro. |
| GD-03 | VALIDADO | Título escapado; impressão pela prévia isolada; sem janela filha. |
| GD-04 | VALIDADO (resíduo declarado) | `script-src` restrito a caminhos com versão; `connect-src https:` aceito como resíduo. |
| GD-05 | VALIDADO com ressalva (GD-17) | `oracle_app` é NOSUPERUSER e dono do banco; container do compose; dump validado por allowlist. |
| GD-06 | VALIDADO | `pastaSensivel`, modo de acesso persistido, revogação. |
| GD-07 | VALIDADO | `argumentosDoApp`; flags de desenvolvimento ignoradas quando empacotado. |
| GD-08 | VALIDADO | `filtrarVariaveis` e `ambienteDoSistema`. |
| GD-09 | VALIDADO | Sem `clipboard-read`. |
| GD-10 | VALIDADO | Só a janela principal abre links externos, e só `https:`. |
| GD-11 | VALIDADO (resíduo BAIXA) | Janela de 15 minutos, consumo único. Qualquer `abrirExterno` https arma a janela. |
| GD-12 | VALIDADO (resíduo: `docker` pelo PATH) | `System32\reg.exe` e `tasklist.exe`; só o agente empacotado; chave no DPAPI. |
| GD-13 | VALIDADO | Throttle 20/min, mensagem genérica, spec. |
| GD-14 | VALIDADO | 27 de 27. |
| GD-15 | VALIDADO | `!process.env.VERCEL`; `CORS_ALLOW_LOCALHOST=false`. |
| GD-16 | ABERTO (INFO), parcial | Atalho exige modificador; `$oracleBlob` só aceita `data:`. Fuses e RunAsNode ficam para a Fase 6. |

## Achados novos
| ID | Severidade | Título | Local | Correção recomendada |
|---|---|---|---|---|
| GD-17 | MEDIA | A sessão de superusuário executa SQL resolvido pelo `search_path` num schema de `oracle_app` (padrão CVE-2018-1058). O validador do dump pode ser dessincronizado com `SET standard_conforming_strings = off`. | `postgres.ts` (bloco `DO` com `format` e `pg_get_userbyid`), `importacao.ts` (`COMANDOS_ACEITOS`) | Fixar o `search_path` em `pg_catalog,pg_temp` na sessão de superusuário e qualificar as funções. Validar `SET` por lista exata, com `standard_conforming_strings` só `on`. Tratar `"…"` como identificador. Testar ambos. |
| GD-18 | BAIXA | O servidor da 3001 não é autenticado: um processo pode ocupar a porta entre a checagem e o `listen`, ou durante um reinício, e `esperarPronta` aceita qualquer 401 em JSON. | `backend.ts`, `api.ts` | Segredo por execução e desafio HMAC numa rota de saúde; se falhar, fase `erro`. |
| GD-19 | INFO | A prévia isolada ainda consegue vazar o próprio conteúdo por GET (`img-src`, `script-src`, `style-src` e `font-src https:`). Não alcança os dados do app. | `previa.ts` | Opcional: modo de prévia sem rede, ou aviso ao abrir HTML gerado a partir de dados externos. |
| (INFO) | INFO | O `fileSystem` não confere `isMainFrame` (limitação do Chromium). Um iframe da mesma origem herdaria as pastas, e o `frame-src` ainda tem `'self' blob: data:`. | `permissoes.ts`, `protocolo.ts` | Remover `blob:` e `data:` do `frame-src`; manter HTML gerado em iframe `sandbox` sem `allow-same-origin`. |

## Condições (registro)
1. Marcar GD-01 a GD-15 como VALIDADO (ref. `gates/oracle-desktop-r2`). GD-16 continua ABERTO.
2. Registrar GD-17, GD-18 e GD-19. Corrigir o GD-17 antes da Fase 6.
3. Rodar `npx jest` de novo (esperado 512/512) e gerar de novo a cópia de `achados.md` no build da API.
