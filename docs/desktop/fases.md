# Oracle Desktop — registro por fase

Arquitetura e auditoria: [arquitetura.md](arquitetura.md).

## Como rodar

| Modo | Comando (em `desktop/`) | O que carrega |
|---|---|---|
| Desenvolvimento | `npm run dev` | Vite em `http://localhost:5173` (HMR); API do `dev.cmd` |
| Produção local | `npm run build:renderer` e depois `npm start` | build de `ts/demo/dist` em `oracle-app://app` |

Fora do app instalado, o perfil do Electron fica em `%APPDATA%\Oracle (dev)`, para nunca tocar no perfil do Oracle instalado (`%APPDATA%\Oracle`).

---

## Fase 1: auditoria e documentação (concluída)
- **Arquivos:** `docs/desktop/arquitetura.md` (novo).
- **Dependências novas:** nenhuma.
- **Código alterado:** nenhum.

## Fase 2: Electron com o frontend existente (concluída)

**Arquivos novos**
- `desktop/package.json`, `desktop/tsconfig.json`, `desktop/.gitignore`
- `desktop/src/main/app.ts`: ciclo de vida, instância única, AppUserModelId.
- `desktop/src/main/config.ts`: modos dev/produção, origem, caminhos, perfil dev separado.
- `desktop/src/main/protocolo.ts`: esquema `oracle-app://app` (standard + secure), serve o `ts/demo/dist` com fallback de SPA, bloqueia traversal, aplica a CSP.
- `desktop/src/main/navegacao.ts`: navegação presa à origem do app. Links http(s) abrem no navegador do sistema. Janelas filhas só para `about:blank` e blob da própria origem. `<webview>` é bloqueado.
- `desktop/src/main/janela.ts`: `BrowserWindow` com `contextIsolation`, `sandbox`, `nodeIntegration: false` e `webSecurity`.
- `desktop/src/preload/index.ts`: `window.oracleDesktop` via `contextBridge`.
- `ts/api/src/bootstrap-cors.spec.ts`

**Arquivos alterados**
- `ts/api/src/bootstrap.ts`: a origem `oracle-app://app` (`ORIGEM_DESKTOP`) é aceita no CORS. É uma mudança aditiva.

**Dependências novas** (só em `desktop/`, versões fixas)
- `electron` 45.2.2
- `typescript` 5.9.3
- `@types/node` 22.20.5

**Testes**
- API: `npx jest` passou (27 suítes, 502 testes), incluindo o novo spec de CORS:
  - aceita `oracle-app://app` e `localhost:5173`;
  - barra `oracle-app://outro`, `evil-app://app` e `https://exemplo.com`.
- Electron em produção:
  - abre em `oracle-app://app/login`, com fontes carregadas;
  - o modelo do wake word é servido como `application/gzip`;
  - um asset inexistente devolve 404 (e não o HTML);
  - `require` e `process` não existem na página;
  - um `fetch` da página à API passa no CORS.
- Versão web: `npm run build` sem erros.

## Fase 3: autenticação e sessão (concluída)

**Arquivos novos**
- `desktop/src/main/sessao.ts`: o token fica cifrado com `safeStorage` (DPAPI) em `userData/sessao.bin` e em cache na memória. Sem cifra disponível, o token fica só em memória; nunca cai para texto puro.
- `desktop/src/main/ipc.ts`: canais `oracle:sessao:obter` e `oracle:sessao:salvar`, síncronos. Eles só respondem ao frame principal da janela principal na origem do app, e o argumento é validado.
- `ts/demo/src/utils/desktop.ts`: `ponteDesktop()` e `ehDesktop()`, mais os tipos da ponte.

**Arquivos alterados**
- `desktop/src/preload/index.ts` e `desktop/src/main/app.ts`: ponte `oracleDesktop.sessao`.
- `ts/demo/src/utils/sessaoLocal.ts`:
  - `tokenArmazenado()` lê do cofre no desktop e do localStorage na web;
  - novo `gravarToken()`;
  - um token legado no localStorage do perfil desktop é migrado para o cofre e removido.
- `ts/demo/src/utils/jwt.ts`: `setSession` grava por `gravarToken`.
- Leituras diretas de `localStorage["authToken"]` passaram a usar `tokenArmazenado()`:
  - `contexts/auth/Provider.tsx`
  - `contexts/memory/persistencia.ts`
  - `pages/Auth/index.tsx`
  - `prototypes/contas/screens/SelecionarRepositorio.tsx`
  - `services/api/ai.ts`
  - `utils/escopoConta.ts`

**Dependências novas:** nenhuma.

**Testes**
- Desktop:
  - o login com a conta demo leva a `/oracle/memoria-grafo`;
  - `localStorage.authToken` fica `null` e `sessao.bin` não contém o JWT em claro;
  - ao fechar e reabrir, o app entra direto (sessão recuperada);
  - `salvar(null)` apaga `sessao.bin`;
  - a janela filha (blob) não tem `oracleDesktop`.
- Web (Browser pane): o login continua gravando em `localStorage` e a ponte não existe.
- `ts/demo`: `tsc -b` e `test:unit` passaram. API: 502 testes passaram.

**Pendências**
- Renovação do token de login: a API não emite refresh token. A sessão dura `JWT_EXPIRES_IN` e depois pede login, como na web. A renovação dos tokens OAuth dos conectores já acontece no servidor e não muda.
- O perfil desktop tem seu próprio localStorage: notas, chats e preferências chegam pela importação da Fase 4.

## Fase 4: integrações e serviços (concluída)

### 4a. OAuth dos conectores pelo navegador do sistema
**API (mudança aditiva; sem `origem`, o comportamento é idêntico)**
- `oauth-retorno.ts`: tipo `OrigemOauth`, constante `RETORNO_DESKTOP = oracle-desktop://conectores` e função `origemOauth()`.
- `oauth-state.service.ts`: o `state` assinado carrega `o: "desktop"`. A função `origemDe()` serve só para escolher o destino do retorno.
- `oauth-provider.service.ts` e `slack-oauth.service.ts`: ganharam `frontRetorno(state)` e o parâmetro `origem` em `buildAuthorizeUrl`.
- `email`, `agenda`, `drive` e `slack.controller.ts`: aceitam `?origem=desktop` em `/autorizar`; o callback passa a usar `frontRetorno`.

**Desktop**
- `desktop/src/main/deepLink.ts`: registra o protocolo `oracle-desktop://` com `--` no fim do comando, para que a URL não injete flags.
  - Só aceita o destino `conectores`.
  - Só aceita os parâmetros `conector`, `status`, `conta` e `motivo`.
- IPC `oracle:abrir-externo`, que só abre https.

**Front**
- `services/api/conectores.ts` envia `origem=desktop`.
- `Conectores.tsx` abre o consentimento no navegador do sistema.

**Testes**
- `oauth-origem.spec.ts` cobre:
  - origem gravada no state;
  - state adulterado ignorado;
  - state expirado ainda devolvendo o destino;
  - query aceitando só o valor exato;
  - URL de retorno.
- Na API real, `/conectores/email/gmail/autorizar?origem=desktop` gera a URL do Google com `o: desktop` no state.
- Deep link por segunda instância, em dev e em produção: abre Conectores, mostra o aviso e descarta o parâmetro estranho.

### 4b. Telegram em segundo plano e permissões
- `CaixaTelegramSync.tsx`: no desktop, o dreno não para com a janela oculta. A janela também usa `backgroundThrottling: false`.
- `desktop/src/main/permissoes.ts`: lista fechada de permissões, só para a origem do app.
  - Microfone, nunca câmera.
  - Área de transferência, tela cheia e armazenamento persistente.
  - File System Access limitado às pastas que você escolheu. Elas ficam em `userData/pastas-autorizadas.json`, para não pedir de novo a cada abertura.
- `desktop/src/main/origem.ts`: o `URL.origin` do Node devolve `"null"` para `oracle-app://`, então toda comparação de origem passa por aqui. Isso corrigiu IPC, navegação e permissões no modo de produção.
- **Testes:** microfone e área de transferência concedidos; câmera e geolocalização negadas.

### 4c. Ditado por voz
- **API:** `POST /ai/audio/transcrever` só transcreve, com a mesma chave OpenAI de `/ai/audio`. `transcrever.ts` ganhou o parâmetro opcional `idioma`.
- **Front:**
  - `utils/ditadoGravado.ts` imita o `SpeechRecognition`: grava com `MediaRecorder`, encerra no silêncio, transcreve na API e devolve um resultado final.
  - `PromptBar` e `resumo-matinal` usam esse caminho só quando `ehDesktop()`.
- **Teste:** um áudio gravado no Electron e enviado ao endpoint voltou 201 com `{texto}`.

### 4d. Dados do navegador: exportar na web, importar no desktop
- `pages/ceo/oracle-desktop/migracao.ts`:
  - exporta o localStorage (sem `authToken`) e os IndexedDB `Oracle` e `ceo-memoria` (sem handles de pasta);
  - na importação, só sobrescreve dados existentes se você confirmar.
- `OracleDesktopSection.tsx`: seção nova em Configurações → Geral → Oracle Desktop. Na web mostra "Exportar"; no desktop, "Importar" e "Servidor do Oracle".
- `OfertaImportacao.tsx`: oferece a importação uma vez, na primeira abertura com sessão.
- **Testes**
  - Exportação real na web: 20 chaves e os documentos, sem `authToken` e sem handles.
  - Importação de teste no Electron:
    - detecta conflito e preserva o dado local;
    - sobrescreve quando você pede;
    - restaura blobs;
    - ignora `authToken` e handles;
    - recusa arquivo inválido;
    - mantém a sessão intacta.

### 4e. API e Postgres embutidos
**`desktop/scripts/preparar-api.mjs`**
- Compila a API para `desktop/build/api`, sem tocar no `ts/api/dist` do `dev.cmd`.
- Instala só as dependências de produção (pelo lockfile da API) mais o CLI do Prisma.
- Gera o client só para Windows, compila o seed e copia `achados.md`.

**`desktop/src/main/servicos/`**
- `postgres.ts`: Postgres 16.15.
  - `initdb` com scram-sha-256 e senha aleatória.
  - Escuta só em `127.0.0.1`, na porta 5434 ou na próxima livre.
  - Inicia e para via `pg_ctl`.
- `api.ts`:
  - a API roda num `utilityProcess` na 3001, só em 127.0.0.1;
  - reinicia sozinha até 5 vezes em 5 minutos;
  - migrations e seed rodam como Node do próprio app;
  - a saúde é verificada por `GET /user/profile` = 401.
- `segredos.ts`: guarda a senha do banco, `JWT_SECRET`, `ENCRYPTION_KEY` e as variáveis importadas, cifrados (safeStorage) em `userData/backend.bin`.
- `backend.ts`:
  - modo **externo**: já existe uma API do Oracle na 3001, ou o app roda com `--oracle-dev`;
  - modo **embutido**: sobe o banco, aplica as migrations, roda o seed na primeira vez e sobe a API;
  - tudo para ao sair.
- `importacao.ts`: importa o ambiente de desenvolvimento.
  - Lê o `.env` da API.
  - Copia o banco com `pg_dump` dentro do container; o original só é lido.
  - Restaura no banco embutido, depois da sua confirmação.
  - Copia `.desktop/servidor.pem`, a chave fixada pelo Oracle Local Agent.
  - Aplica migrations novas e reinicia a API.

**Outros arquivos**
- `desktop/src/main/splash.ts`: tela de abertura. A interface só carrega com a API pronta, o que evita o "modo local".
- `ts/api/src/main.ts`: `HOST` configurável (padrão `0.0.0.0`), documentado em `.env.example`.

**Testes**
- Primeira abertura: `initdb`, 54 migrations, seed (15 squads e 75 agentes) e API pronta.
- Aberturas seguintes: API respondendo em 7 s.
- `netstat` confirma que API e banco escutam só em `127.0.0.1`.
- Fechar o app para a API e encerra o Postgres de forma limpa.
- Importação em 10 s.
  - Contagens iguais às da origem: 8 usuários, 8 empresas, 725 notas, 4 conectores e 54 migrations.
  - O Docker ficou inalterado.
  - O Telegram ligou com o token importado.
- Login demo e `/user/profile` = 200; a sessão fica cifrada e o localStorage vazio.

**Dependências novas (em `desktop/`, versões fixas)**
- `@embedded-postgres/windows-x64` 16.15.0-beta.19
- `pg` 8.23.1
- `@types/pg` 8.15.6
- No pacote da API: `prisma` 6.19.3, a mesma versão de `ts/api`.

**Regressão**
- API: 28 suítes, 507 testes passando.
- `ts/demo`: `tsc -b`, `test:unit` e o eslint dos arquivos novos limpos.
- Na web, login, Configurações e exportação funcionam no navegador.

**Pendências da Fase 4**
1. **Telegram em dois lugares:** a API de desenvolvimento e o app desktop rodando juntos com o mesmo `TELEGRAM_BOT_TOKEN` disputam as mensagens no long-poll. Use um de cada vez, ou deixe o token só no app.
2. **OAuth real com Google, Microsoft e Slack:** o consentimento completo não foi testado, porque exige a sua conta. O caminho até a URL do Google e a volta pelo deep link estão testados.
3. **File System Access:** a persistência da pasta do Repositório entre aberturas precisa de teste manual, porque o seletor nativo não é automatizável.
4. **Ditado:** o limiar de silêncio (1,5 s) foi calibrado sem fala real.
5. **`safeStorage` síncrono:** está marcado como obsoleto no Electron 45. Migrar para as variantes assíncronas.
6. **Pacote da API:** ocupa cerca de 540 MB, a maior parte do Prisma. Reduzir na Fase 6.
7. **Banco embutido sem conta demo:** não é semeada de propósito, por ser uma credencial conhecida. Sem importar o ambiente, o primeiro uso é "Criar conta".

## Fase 5: Oracle Local Agent e recursos desktop

### Arquivos novos
- `desktop/src/main/servicos/agente.ts`: supervisão do Oracle Local Agent sem IPC nem porta nova (SR-24).
  - Lê de `%LOCALAPPDATA%\Oracle\agent.json` só se está pareado, a URL da API e o "parado localmente".
  - Verifica se o processo está rodando.
  - Inicia `oracle-agent run --background` quando você pede, ou ao abrir o app se a preferência estiver ligada.
  - Procura o executável nesta ordem: o cadastrado pelo próprio agente na chave Run, o empacotado e o build local.
  - Registra o que fez em `logs/agente.log`.
- `desktop/src/main/preferencias.ts`: grava `userData/preferencias.json` e valida campo a campo.
  - Fechar para a bandeja: ligado.
  - Iniciar com o Windows: desligado.
  - Começar na bandeja: ligado.
  - Atalho global: `Ctrl+Alt+O`.
  - Iniciar o agente: **desligado**.
  - Notificações: ligadas.
- `desktop/src/main/bandeja.ts`: ícone na bandeja.
  - O menu tem Abrir, o estado do servidor e do agente, Iniciar o agente, Iniciar com o Windows, Fechar para a bandeja e Sair.
  - O estado é revisado a cada 30 s.
- `desktop/src/main/recursosDesktop.ts`:
  - iniciar com o Windows via `setLoginItemSettings` (só no app instalado, com `--oracle-bandeja`);
  - atalho global, que volta ao anterior se for inválido ou já estiver em uso;
  - notificação nativa: clicar traz o Oracle para a frente.
- `desktop/scripts/gerar-icones.cjs` e `desktop/recursos/`: `icon.ico` (16–256), `icon.png`, `bandeja.png` e `bandeja@2x.png`, gerados de `oracle-favicon.svg`.
- `ts/demo/src/app/pages/ceo/oracle-desktop/PreferenciasDesktopSection.tsx`: cartões "App desktop" e "Oracle Local Agent" em Configurações → Oracle Desktop.

### Arquivos alterados
- `desktop/src/main/janela.ts`:
  - ícone da janela;
  - fechar esconde na bandeja, com aviso na primeira vez;
  - `alternarJanelaPrincipal` (atalho e clique no ícone);
  - janela oculta quando o app abre no login.
- `desktop/src/main/app.ts`:
  - bandeja, atalho e início com o Windows;
  - `session-end`: no logoff ou desligamento, sai de verdade e para o banco;
  - "Sair" libera os atalhos e remove o ícone antes de parar o backend.
- `desktop/src/main/ipc.ts` e `preload`: canais `preferencias:obter/salvar`, `agente:estado/iniciar` e `notificar`, todos com a mesma validação de remetente.
- `CaixaTelegramSync.tsx`: com o Oracle ao fundo ou na bandeja, uma nota nova do Telegram também gera notificação do Windows.

### Testes
- Bandeja criada e atalho global registrado.
- Agente localizado pelo build local, iniciado e registrado no `agente.log`.
- Fechar a janela deixa o app oculto, não destruído, com a API respondendo.
- Atalho inválido é recusado (`atalhoOk: false`) e o anterior volta. Um atalho válido é aplicado.
- Campos estranhos ou de tipo errado nas preferências são ignorados.
- A notificação nativa aparece.
- Ao sair, a API e o Postgres param (portas 3001 e 5434 livres) e não fica processo do Electron.
- A seção de Configurações aparece com os cartões no desktop.

### Ocorrência durante os testes
- Ao iniciar o agente local, ele recebeu **"revogado"** e apagou o próprio pareamento (`agent.json`).
- O dispositivo já estava revogado no banco de desenvolvimento do Docker **desde 17/11 às 20:20**. Esse banco só foi lido, nunca alterado. O agente não rodava desde 13/11 e ainda não sabia.
- Teria acontecido igual com a API de desenvolvimento. O app não errou; o efeito foi disparado pelo início automático.
- **Consequências:**
  - "Iniciar o agente com o Oracle" passou a ser **desligado por padrão**;
  - para usar o controle do computador de novo, refaça o pareamento em Configurações → Ambiente local.
- O processo do agente, agora sem pareamento, ficou aberto. Feche pelo ícone dele, em "Sair".

### Pendências da Fase 5
- O atalho é editado como texto no formato do Electron (`CommandOrControl+Alt+O`). Um campo que capture as teclas seria mais amigável.
- Iniciar com o Windows só é verificável no app instalado (Fase 6).
### Gate de segurança
- **Rodada 1** (`docs/security/gates/oracle-desktop-r1.md`): **REPROVADO**.
  - GD-01 (ALTA): as prévias geradas por IA abriam como `blob:` na origem do app e herdavam as pastas autorizadas do Repositório.
  - GD-14: não havia testes em `desktop/`.
  - Também havia 5 achados médios e 9 baixos ou informativos.
- **Correções**, registradas em `docs/security/achados.md` como GD-01 a GD-16:
  - **Prévias isoladas:** `desktop/src/main/previa.ts` e `ts/demo/src/utils/abrirPrevia.ts`. A web não muda.
  - **Permissões** só para o documento da janela principal. Pastas sensíveis são recusadas, e há uma UI para revogar.
  - **Postgres:** papel `oracle_app` sem superusuário, dump validado por allowlist e container conferido pelo compose.
  - **Modo externo** proibido no app instalado. Flags de desenvolvimento são ignoradas.
  - **Variáveis de ambiente** por allowlist. A chave do gateway desktop vai para o DPAPI.
  - **Navegação:** sem janelas filhas, e links externos só https a partir da janela principal.
  - **Deep link** só aceito com OAuth pendente.
  - **Transcrição:** mensagem de erro genérica e throttle de 20/min.
  - **CSP:** `script-src` com caminhos versionados.
- **Testes novos:**
  - `desktop`: `npm test`, 27 testes.
  - API: `audio-transcrever.spec.ts`.
  - Em tempo de execução: uma prévia hostil fica sem armazenamento, sem ponte, com origem `null` e sem fetch. O restore como `oracle_app` deu certo, com `COPY PROGRAM` negado. O validador aceita o dump real.
- **Rodada 2** (`docs/security/gates/oracle-desktop-r2.md`): **APROVADO**.
  - GD-01 a GD-15 viraram `VALIDADO`.
  - O GD-16 continua `ABERTO` (INFO, Fase 6).
  - **Achados novos:**
    - GD-17 (MEDIA): `search_path` na sessão de superusuário e dessincronia do validador do dump. Corrigido na mesma rodada: `search_path` fixo, funções qualificadas, `SET` por lista exata e identificadores entre aspas. Coberto por 3 testes; o dump real continua aceito.
    - GD-18 (BAIXA): falta autenticar a API da 3001. Continua `ABERTO`.
    - GD-19 (INFO): a prévia isolada ainda consegue vazar o próprio conteúdo. Continua `ABERTO`.
    - GD-20 (INFO): `frame-src` restrito. Corrigido.
- **Bug achado durante o GD-20:** no desktop, a prévia do Dashboard (iframe `srcdoc`) herdava a CSP do app, e os scripts dos gráficos não rodavam desde a Fase 2.
  - Agora o iframe usa uma URL isolada `oracle-previa:`, com CSP própria. Na web, `srcdoc` continua como antes.
  - Testado: o script roda, sem storage, sem ponte, sem acesso à página pai e sem violação de CSP.
- **Regressão final:**
  - API: 512 de 512, incluindo o SR-51 sem ALTA pendente.
  - `desktop`: `npm test` 30 de 30 e `npm audit` com 0 vulnerabilidades.
  - `ts/demo`: `tsc`, `test:unit` e eslint sem erros.
- A cópia de `achados.md` no build da API (`desktop/build/api/achados.md`) foi atualizada.

## Fase 6: empacotamento, atualização e testes

Como gerar, publicar e atualizar: [`desktop/README.md`](../../desktop/README.md).

### Arquivos novos
- `desktop/scripts/build.mjs` (`npm run dist` e `npm run release`) gera o instalador em cinco etapas:
  1. a interface;
  2. a API embutida;
  3. o agente self-contained;
  4. `npm test`: se falhar, não empacota;
  5. o electron-builder.
- `desktop/scripts/apos-empacotar.cjs` (hook afterPack): copia as dependências da API, porque o electron-builder nunca copia `node_modules` de `extraResources`.
- `desktop/src/main/servicos/migracoes.ts`: faz o `prisma migrate deploy` **sem o CLI do Prisma**.
  - Mesmo protocolo e mesma tabela `_prisma_migrations`, então o banco continua compatível com o CLI.
  - O checksum é o SHA-256 do arquivo; conferi o algoritmo contra 51 de 54 linhas reais (as outras 3 diferem só por CRLF).
  - Banco novo: 54 migrations em 2,3 s, com estrutura idêntica à atual (52 tabelas, 29 enums, 152 índices).
- `desktop/runtime/executor.cjs`: roda o seed num `utilityProcess` e encerra o processo ao fim do `$disconnect`. Um `utilityProcess` não termina sozinho, nem `beforeExit` dispara.
- `desktop/src/main/atualizacao.ts`: electron-updater pelo GitHub Releases.
  - Só no app instalado.
  - Verifica ao abrir e a cada 6 h e baixa em segundo plano.
  - Pergunta antes de reiniciar. Se você recusar, instala ao sair.
  - O menu da bandeja tem "Verificar atualizações".
- `desktop/recursos/instalador.nsh`:
  - `customInit` executa `Oracle.exe --sair` antes de trocar os arquivos.
  - `customUnInstall` remove o protocolo e o "iniciar com o Windows", exceto numa atualização.
- `desktop/README.md`.

### Arquivos alterados
- `desktop/package.json`: configuração do electron-builder e fuses (GD-16).
  - **NSIS:** instalação por usuário, pasta escolhível, atalhos na área de trabalho e no menu Iniciar, desinstalador e `deleteAppDataOnUninstall: false`.
  - **Publicação:** GitHub `depositodomike-cyber/Batsystem`. O repositório é público, então o app instalado não precisa de token.
  - **Fuses:**
    - desligados: `runAsNode`, `NODE_OPTIONS` e `--inspect`;
    - ligados: asar só com validação de integridade e cookies cifrados.
  - **Versões:** `electron-builder` 26.18.1 e `electron-updater` 6.8.12.
- `desktop/src/main/config.ts`: no app instalado, a interface fica **dentro do app.asar**, coberta pela validação de integridade.
- `desktop/src/main/app.ts`:
  - recusa abrir com depuração remota;
  - `--sair` encerra a instância aberta pelo caminho normal, ou sai na hora se não houver uma aberta;
  - inicia o atualizador.
- `desktop/src/main/servicos/api.ts`: migrations nativas e seed pelo executor; nada usa `ELECTRON_RUN_AS_NODE`.
- `desktop/scripts/preparar-api.mjs`: sem o CLI do Prisma; o client é gerado com o CLI do `ts/api`. A API embutida caiu de **540 MB para 332 MB**.
- Agente publicado self-contained, single-file e **comprimido**: de 172 MB para 73 MB.

### Instalador
| Item | Valor |
|---|---|
| Arquivo | `desktop/release/Oracle-Setup-0.1.0.exe`, 340 MB (descompactado: cerca de 630 MB) |
| Instala em | `%LOCALAPPDATA%\Programs\Oracle` |
| Dados | `%APPDATA%\Oracle` (banco, sessão, preferências, logs) |
| Assinatura | não há: o SmartScreen avisa na primeira instalação |

### Testes nesta máquina
Não deu para testar numa máquina limpa: o Windows Sandbox não está disponível aqui.

- **App empacotado** (`win-unpacked`, fuses ligados):
  - a primeira abertura criou o banco, as 54 migrations e o seed, e a API respondeu em 9 s;
  - criei uma conta local de teste e entrei;
  - fechar a janela levou o app para a bandeja; sair encerrou tudo;
  - ao reabrir, a sessão continuou válida e `/user/profile` respondeu 200;
  - o protocolo foi registrado com `-- "%1"`.
- **Instalação silenciosa** (`/S`, por usuário):
  - pasta, atalhos e registro de desinstalação criados;
  - com `--remote-debugging-port`, o app recusou abrir;
  - sem a flag, a API respondeu em 10 s e o Postgres rodou da pasta instalada;
  - a janela abriu no Repositório já logada, com os dados preservados.
- **Atualização 0.1.0 → 0.1.1** por cima:
  - versão 0.1.1;
  - banco, sessão e preferências mantidos (abriu logado);
  - `Oracle.exe --sair` fez shutdown limpo do Postgres, sem sobrar processo.
- **Desinstalação silenciosa:** removeu pasta, atalhos, menu Iniciar, registro e protocolo, e manteve `%APPDATA%\Oracle`.
- **Regressão:** `desktop` com `npm test` 34/34 e `npm audit --omit=dev` em 0.
- **Auditoria do desktop:** 6 vulnerabilidades moderadas (`minimatch`), só nas ferramentas de build (electron-builder). Não vão no instalador.

### Gate de segurança, rodada 3
`docs/security/gates/oracle-desktop-r3.md`: **APROVADO**.
- **Validados:** GD-16 (fuses lidos no binário), GD-17 e GD-20.
- **Achados novos, já corrigidos:**
  - **GD-21:** atualização sem autenticidade. Agora cada atualização tem uma assinatura própria Ed25519, verificada pelo app antes de instalar (`verificacaoAtualizacao.ts`, `scripts/assinar-atualizacao.mjs`). Verifiquei com o instalador real.
  - **GD-22:** token durante o build. O build agora roda sem token; o token só entra no envio dos arquivos prontos.
  - **GD-23:** API com `npm ci`, `audit fix` sem troca de versão major e um gate que barra vulnerabilidade crítica. Resultado: de 18 para 5 vulnerabilidades, nenhuma crítica.
  - **GD-26:** flags perigosas do Chromium são recusadas, conferindo o argv recebido.
  - **GD-27:** `client_encoding` só `UTF8`.
- **Aceitos (T16):** GD-24 e GD-25.
- **Abertos:**
  - GD-18 (BAIXA): falta autenticar a API da 3001;
  - GD-19 (INFO): a prévia pode vazar o próprio conteúdo;
  - GD-28 (INFO): os releases saem no mesmo repositório público. A decisão é sua.
- **Bug achado no reteste e corrigido antes de empacotar:** `app.commandLine` inclui switches que o próprio Electron adiciona (`enable-features`), e isso fazia o app instalado fechar sozinho.
- **Regressão final:**
  - `desktop`: `npm test` 40/40 e `npm audit --omit=dev` em 0;
  - API: 512/512;
  - instalador final assinado e verificado (`autentica: true`).

### Pendências da Fase 6
1. **Assinatura de código (Authenticode):** sem certificado, o SmartScreen avisa na primeira instalação. As atualizações já são protegidas pela assinatura própria (GD-21).
2. **Teste numa máquina limpa** (sem Node, Docker ou repositório): não foi possível aqui. Recomendo instalar o `.exe` em outro PC ou numa VM.
3. **Publicação:** nada foi publicado. O primeiro release precisa de `GH_TOKEN` (`npm run release`), 2FA na conta do GitHub e **backup da chave** `%USERPROFILE%.oracle-desktopave-atualizacao.pem`.
4. **Conta de teste:** o banco do Oracle instalado (`%APPDATA%\Oracle`) tem a conta local `teste.desktop@oracle.local`, criada no teste. Some quando você importar o seu ambiente, que substitui o banco.
