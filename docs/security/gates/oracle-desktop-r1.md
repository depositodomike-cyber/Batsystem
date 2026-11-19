<!-- Parecer emitido pelo Security Engineer Agent (revisor independente). Registrado sem alterar o veredito. -->
# Parecer: Gate de código — Oracle Desktop (Electron), Fases 2–5
Veredito: **REPROVADO**. Há um achado ALTA aberto (GD-01). A correção é barata e não exige mudar a arquitetura.
Data: 2026-11-18

## Escopo revisado
- **Desktop:**
  - `desktop/src/main/*.ts`: app, janela, ipc, origem, navegacao, protocolo, permissoes, deepLink, sessao, preferencias, recursosDesktop, splash e config.
  - `desktop/src/preload/index.ts`.
  - `desktop/src/main/servicos/*.ts`: postgres, api, backend, segredos, importacao, agente e caminhos.
- **API:**
  - OAuth: `oauth-state.service.ts`, `oauth-retorno.ts`, `oauth-provider.service.ts`, `slack-oauth.service.ts` e os quatro controllers OAuth.
  - Inicialização: `bootstrap.ts` e `main.ts`.
  - Áudio: `ai/audio.controller.ts` e `ai/audio/transcrever.ts`.
  - Specs novos: `bootstrap-cors.spec.ts` e `oauth-origem.spec.ts`.
- **Front:**
  - `utils/desktop.ts`, `utils/sessaoLocal.ts`, `utils/jwt.ts`, `Conectores.tsx` e `oracle-desktop/migracao.ts`.
  - Os pontos que abrem `window.open`, blob ou iframe: `Analise.tsx:306`, `Dashboard.tsx:153,350`, `Apresentacao.tsx:975`, `Carrossel.tsx:324` e `SidePanel.tsx:403`.

## Evidências
- `desktop`:
  - `npx tsc --noEmit`: exit 0.
  - `npm audit --omit=dev` e `npm audit`: 0 vulnerabilidades.
- `ts/api`, `npx jest`: 28 suítes, 507 testes, todos passando. Inclui:
  - `oauth-origem.spec.ts`: 5 casos;
  - `bootstrap-cors.spec.ts`.
- Busca no front: nenhum `dangerouslySetInnerHTML` ou `innerHTML` com dado. O único `document.write` está em `Analise.tsx:308`. O iframe do Dashboard usa `sandbox="allow-scripts"`, sem `allow-same-origin`.
- **Não há testes automatizados em `desktop/`.**
- **Limitação:** o revisor não executa o app Electron. O comportamento em tempo de execução foi deduzido do código.

## Verificação por item
| Item | Resultado |
|---|---|
| **1. Isolamento** | OK: `contextIsolation`, `sandbox` e `nodeIntegration: false`. O preload é congelado. `remetenteConfiavel` exige a janela principal, o frame principal e a origem do app, e recusa janelas filhas, iframes, splash e blob no frame principal. **Furo:** uma janela `about:blank` sem `noopener` (`Analise.tsx:306`) alcança a ponte via `window.opener` (GD-03). |
| **2. Protocolo** | `resolverDentro` está correto: barra `..`, `%2e%2e`, `%5c` e UNC. A CSP é ampla nos CDNs (GD-04). |
| **3. Navegação** | Correta quanto a `<webview>` e links externos. Ainda permite navegação para `blob:` e abertura externa sem gesto do usuário (GD-01, GD-10). |
| **4. Permissões** | Ver GD-01, GD-06 e GD-09. |
| **5. Deep link** | `--` no registro do protocolo, host fixo e allowlist de parâmetros: sem injeção de flags nem open redirect. Resta o spoofing de aviso (GD-11). |
| **6. OAuth** | `origem` escolhe só o destino, que é constante. `origemDe` exige HMAC válido. `verify`, a troca do código e o `redirect_uri` ficam iguais. Não dá para desviar o código nem o dono da autorização. |
| **7. Sessão** | Atendido: DPAPI ou só memória, nunca em claro. |
| **8. Backend embutido** | Escuta em 127.0.0.1, scram-sha-256 com senha aleatória, DPAPI e sem shell. Ver GD-02, GD-05, GD-07, GD-08 e GD-12. |
| **9. Agente** | SR-24 preservado: spawn detached e só leitura. Ver GD-12. |
| **10. Transcrição** | JWT, `ia.usar`, 10 MB e allowlist de idioma. Ver GD-13. |

## Achados
| ID | Severidade | Título | Local | Correção recomendada |
|---|---|---|---|---|
| GD-01 | ALTA | Permissões concedidas por **origem**, não pela janela ou frame principal. Janelas blob com HTML gerado por IA herdam as pastas persistidas do File System Access. | `permissoes.ts:81-86,73-76,88-90`; `navegacao.ts:20-22,32,38` | Exigir a janela principal, o frame principal e `requestingUrl` na origem do app. Abrir as prévias de IA numa origem opaca. Remover `blob:` do `will-navigate`. Testar que um blob filho recebe `false`. |
| GD-02 | MEDIA | O modo "externo" aceita qualquer processo na 3001 sem autenticar o servidor. | `backend.ts:101-104`, `api.ts:132-141` | No app empacotado, nunca usar o modo externo. Ou autenticar a API embutida. Falhar fechado. |
| GD-03 | MEDIA | `about:blank` sem `noopener` dá acesso à ponte via `window.opener`. O título entra no `document.write` sem escape. | `Analise.tsx:306-314`, `navegacao.ts:38` | Escapar o título. Imprimir sem `opener`. Endurecer a ponte. Corrigir os comentários. |
| GD-04 | MEDIA | A CSP libera `script-src` para todo jsdelivr e unpkg. | `protocolo.ts:39` | Restringir a caminhos com versão, ou empacotar os assets. |
| GD-05 | MEDIA | O Postgres embutido usa o superusuário para a API e para o restore, o que permite `COPY … PROGRAM`. | `postgres.ts`, `importacao.ts` | Criar um papel sem superusuário. Filtrar o dump. Conferir o container. |
| GD-06 | MEDIA | `fileSystem` concede qualquer caminho, para sempre, sem como revogar. | `permissoes.ts:96-101,62-71` | Recusar pastas sensíveis (lista do SR-13). Persistir o modo de acesso. Criar UI de revogação. |
| GD-07 | BAIXA | Flags de desenvolvimento (`--oracle-dev*`, `ORACLE_RENDERER_DIR`) são aceitas no app instalado. | `config.ts:25-41` | Ignorar essas flags quando empacotado. Parar de ler argv no `--`. |
| GD-08 | BAIXA | O `.env` importado passa por denylist; `NODE_OPTIONS` e `ELECTRON_*` passam. | `importacao.ts`, `backend.ts` | Usar allowlist. Limpar o ambiente do processo filho. |
| GD-09 | BAIXA | `clipboard-read` é concedido sem justificativa comprovada. | `permissoes.ts:23-30` | Remover, ou conceder só ao frame principal com gesto do usuário. |
| GD-10 | BAIXA | Qualquer webContents abre http(s) no navegador do sistema sem gesto do usuário. | `navegacao.ts` | Só a janela principal, e só `https:`. |
| GD-11 | BAIXA | O deep link não é autenticado: recarrega a página e mostra texto do atacante. | `deepLink.ts:36-60` | Exigir um nonce de OAuth pendente, ou não recarregar e mostrar um aviso genérico. |
| GD-12 | BAIXA | Binários resolvidos pelo PATH. O exe do agente vem do HKCU Run. `servidor.pem` fica em claro e acumula `.bak`. | `agente.ts`, `importacao.ts` | Usar caminhos absolutos. Preferir o exe empacotado. Guardar a chave em `backend.bin` e remover os `.bak`. |
| GD-13 | BAIXA | `/ai/audio/transcrever` não tem teste, repassa `err.message` e não tem throttle próprio. | `audio.controller.ts:146-173` | Mensagem genérica. `@Throttle` de 20/min. Spec. |
| GD-14 | MEDIA | Não há testes automatizados dos controles de segurança em `desktop/`. | `desktop/` | Testes de `remetenteConfiavel`, `resolverDentro`, `rotaDoDeepLink`, `urlExternaPermitida`, `validar`, permissões e `lerDotenv`. |
| GD-15 | INFO | `oracle-app://app` é aceito no CORS em todos os ambientes; `CORS_ALLOW_LOCALHOST` é forçado. | `bootstrap.ts:99-102`, `backend.ts:66` | Liberar só fora da Vercel. Não forçar `CORS_ALLOW_LOCALHOST`. |
| GD-16 | INFO | Fase 6: sem fuses. `ELECTRON_RUN_AS_NODE` é necessário. Atalho sem modificador é aceito. `$oracleBlob` não exige `data:`. | `api.ts:40-46`, `preferencias.ts:60`, `migracao.ts:100-101` | Ligar os fuses. Rodar migrations via `utilityProcess`. Exigir modificador no atalho. Aceitar só `data:`. |

### Cadeia do GD-01
1. Um dado externo leva o LLM a gerar, no HTML do Dashboard, um `<script src="https://cdn.jsdelivr.net/npm/<pacote>">`. A CSP permite.
2. Ao clicar em "Abrir em nova aba", abre um `blob:oracle-app://app/…`, que tem a origem do app.
3. O script lê os handles de pasta no IndexedDB. `queryPermission` passa pelo check handler, que responde "granted".
4. O script lê e grava no Repositório e exfiltra os dados por `connect-src https:`.

## Requisitos verificados
| SR | Situação | Evidência |
|---|---|---|
| SR-24 | atendido | `agente.ts`: spawn detached, só leitura, nenhum listener novo do agente. As portas novas do backend ficam em 127.0.0.1. |
| SR-25 | parcial | `servidor.pem` em claro mais os `.bak` (GD-12). |
| SR-34 | atendido | `audio.controller.ts:36-38`; `exigirPodeAlterar` mantido nos controllers OAuth. |
| SR-50 | atendido | `npm audit` do `desktop`: 0. |
| SR-51 | atendido, com observação | A API embutida lê a cópia de `achados.md` do build: gerar o build de novo depois de registrar. |
| SR-01/03/05, SR-35 | atendido (sem regressão) | Nenhuma mudança no gateway nem na política. |
| T19 / OAuth state | atendido | `oauth-state.service.ts:118-134`. |
| T16 | aceito | Configuração local adulterada pelo mesmo usuário está fora de escopo; GD-07 e GD-12 endurecem. |
| Sessão (T25) | atendido | `sessao.ts:37-49`, `sessaoLocal.ts:56-71`. |

## Condições para aprovação
1. GD-01 corrigido, com teste automatizado.
2. GD-14: suíte mínima de testes em `desktop/`.
3. Recomendado na mesma rodada: GD-02, GD-03, GD-04, GD-05 e GD-06.
4. Registrar GD-01 a GD-16 em `achados.md` e gerar de novo a cópia do build da API (SR-51).
