# Oracle Desktop — Arquitetura (Fase 1: auditoria)

Este documento registra o estado do Oracle **antes** da camada Electron e o que
cada peça exige dela. Nenhuma funcionalidade foi alterada nesta fase.

## 1. Peças do sistema

| Peça | Pasta | Onde roda | Como inicia hoje |
|---|---|---|---|
| Web (React 19 + Vite 7, react-router 7 data router) | `ts/demo` | navegador, `http://localhost:5173` | `npm run dev` (via `dev.cmd`) |
| API (NestJS 11 + Prisma 6) | `ts/api` | máquina local, `0.0.0.0:3001` | `npm run start:dev` (via `dev.cmd`) |
| Postgres 16 | `ts/api/docker-compose.yml` | Docker local, `127.0.0.1:5433`, container `batsystem-db` | `npm run db:up` |
| Oracle Local Agent (.NET 8) | `desktop-agent/` | máquina local, usuário logado | `oracle-agent run` ou chave Run do Windows |

Fora do uso: `js/demo`, `js/starter`, `ts/starter` (cópias do UI kit) e os arquivos
de deploy `ts/api/vercel.json`, `ts/api/api/index.js`, `ts/api/Dockerfile`.

## 2. Local × nuvem

**Processos na máquina (tudo dentro da API, exceto o agente):**
- Orquestrador do Assistente — `ts/api/src/orquestrador/` (`POST /ai/orquestrar`, SSE; flag `ORQUESTRADOR_ATIVO`).
- Servidor MCP — `ts/api/src/mcp/` (`POST /mcp`, chave em `Authorization`/`x-api-key`).
- Bot do Telegram — `ts/api/src/conectores/telegram/` (long-poll `getUpdates`, sem webhook) e fila de áudio.
- Transcrição — `ts/api/src/ai/audio/transcrever.ts` (OpenAI `whisper-1`).
- Gateway desktop e política de risco — `ts/api/src/desktop/` (flag `DESKTOP_ATIVO` + `docs/security/achados.md`).
- Conectores OAuth (Gmail, Google Agenda, Google Drive, Outlook, Slack) — `ts/api/src/conectores/`.

**Serviços hospedados (só chamados pela API):** Anthropic/OpenAI e demais
provedores de IA (chave do usuário, cifrada com `ENCRYPTION_KEY`), Google,
Microsoft, Slack, Telegram, busca web, HeyGen, Iugu.

**No navegador:** wake word Vosk (WASM, modelo em `public/wake`), ditado por Web
Speech, voz neural Piper/onnxruntime (CDN jsdelivr), ffmpeg.wasm (CDN unpkg).

## 3. Autenticação

- JWT próprio da API: `POST /login {username,password}` → `{authToken,user}`; `GET /user/profile` na abertura.
- Token em `localStorage["authToken"]`. Leitura central em `ts/demo/src/utils/sessaoLocal.ts` (`tokenArmazenado`), escrita em `utils/jwt.ts` (`setSession`); o interceptor de `utils/axios.ts` lê a cada requisição.
- Leituras diretas de `localStorage["authToken"]` ainda existem em: `contexts/auth/Provider.tsx`, `contexts/memory/persistencia.ts`, `pages/Auth/index.tsx`, `prototypes/contas/screens/SelecionarRepositorio.tsx`, `services/api/ai.ts`, `utils/escopoConta.ts`.
- **Não há refresh token.** Expirou (`JWT_EXPIRES_IN`) → novo login.
- "Modo local": com a API fora do ar o front fabrica um token `alg:none` terminado em `.prototype` (12 h).
- OAuth só existe nos **conectores**: o front pede a URL (`GET …/autorizar`), faz `location.href = url`, o provedor volta ao callback da API em `localhost:3001` e a API redireciona para `FRONT_URL/oracle/conectores?conector=…&status=…` (`ts/api/src/conectores/oauth-retorno.ts`). PKCE + `state` HMAC de 10 min. Tokens dos provedores ficam só no Postgres (AES-256-GCM).

## 4. Onde ficam os dados

| Dado | Onde | Observação |
|---|---|---|
| Contas, organizações, memória indexada, execuções, conectores, mensagens do Telegram | Postgres (`ts/api/prisma`) | segredos cifrados com `ENCRYPTION_KEY` |
| Notas, chats, kanban, preferências, documentos-projetos (`ceo-*`, `oracle.*`) | `localStorage` da origem `localhost:5173`, chaves por conta (`utils/escopoConta.ts`) | perfil do navegador |
| Biblioteca de Documentos | IndexedDB `Oracle` / store `kv` (`utils/idbKv.ts`) | perfil do navegador |
| Handles das pastas do Repositório | IndexedDB `ceo-memoria` (`pages/ceo/memoria-inventario.ts`) | não transferíveis entre programas |
| Arquivos do Repositório (`.md`, anexos, áudio do Telegram) | pasta local escolhida pelo usuário (File System Access) | já estão no disco |
| Config do agente | `%LOCALAPPDATA%\Oracle\agent.json` | sem segredos; chave de dispositivo na CNG |

O dreno da caixa do Telegram para Notas/Repositório roda **no navegador**
(`pages/ceo/telegram/CaixaTelegramSync.tsx`, a cada 30 s, só com a aba visível).

## 5. Dependências entre módulos

```
Web (ts/demo) ──HTTP/SSE + JWT──▶ API (ts/api) ──▶ Postgres
      │                              │  ├─▶ provedores de IA / Google / Microsoft / Slack / Telegram
      │                              │  └─ fila de comandos desktop (Postgres)
      └─ File System Access ─▶ pasta do Repositório         ▲
                                                             │ long-poll HTTPS assinado (ECDSA)
                                          Oracle Local Agent ┘  (sem porta, sem IPC — SR-24)
```

## 6. O que muda com o Electron

| Ponto | Impacto | Tratamento (fase) |
|---|---|---|
| Origem da página | CORS da API (`ts/api/src/bootstrap.ts`) só aceita localhost/lista | origem `oracle-app://app` em `CORS_ORIGIN` (2) |
| `createBrowserRouter` | não funciona em `file://` | esquema próprio padrão/seguro (2) |
| `window.open` / popup de impressão (`Analise.tsx`) | precisa de política | `setWindowOpenHandler` (2) |
| CDNs (unpkg, jsdelivr, Google Fonts) | CSP | CSP explícita no esquema (2) |
| Token em `localStorage` | persistido em claro no perfil | `safeStorage` via preload (3) |
| API + Postgres | exigem Node, Docker e o repositório | API e Postgres embutidos, supervisionados (4) |
| OAuth dos conectores | Google recusa navegador embutido | navegador do sistema + deep link `oracle-desktop://` (4) |
| Ditado Web Speech | não funciona no Electron | gravação + transcrição na API (4) |
| Dreno do Telegram | para com a janela oculta (bandeja) | ignorar visibilidade no desktop (4) |
| Dados do navegador | o perfil Electron é outro | exportar na web / importar no desktop (4) |
| Agente local | já independente do navegador | Electron só inicia/monitora, sem IPC (5) |
