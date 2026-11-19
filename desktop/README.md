# Oracle Desktop

App Windows (Electron) do Oracle. A interface é a de `ts/demo`, a API é a de `ts/api` (embutida, com Postgres próprio) e o Oracle Local Agent vem de `desktop-agent`.

Arquitetura: [../docs/desktop/arquitetura.md](../docs/desktop/arquitetura.md) · registro por fase: [../docs/desktop/fases.md](../docs/desktop/fases.md) · segurança: [../docs/security/achados.md](../docs/security/achados.md).

## Desenvolvimento

O dia a dia não muda: `dev.cmd` sobe a API (3001), o Vite (5173) e usa o Postgres do Docker.

| Comando (nesta pasta) | O que faz |
|---|---|
| `npm install` | instala o Electron e as dependências do app |
| `npm run dev` | abre o app carregando o Vite (HMR); usa a API do `dev.cmd` |
| `npm run build:renderer` e depois `npm start` | abre o app com o build de produção da interface |
| `node scripts/preparar-api.mjs` | gera `build/api` (API embutida) — necessário para testar o backend embutido sem o `dev.cmd` |
| `npm test` | testes dos controles de segurança do processo principal |

Fora do app instalado, os dados do Electron ficam em `%APPDATA%\Oracle (dev)` — rodar o projeto nunca toca no Oracle instalado (`%APPDATA%\Oracle`).

## Gerar o instalador

Requisitos na máquina de build: Node 22+, .NET 8 SDK e os `npm install` de `ts/demo`, `ts/api` e `desktop`.

```powershell
npm run dist
```

Gera `release/Oracle-Setup-<versão>.exe`. O script (`scripts/build.mjs`) compila a interface, a API e o agente, roda `npm test` (falha = não empacota) e chama o electron-builder.

## Publicar uma atualização

Antes da primeira publicação (uma vez):

- **Chave de assinatura das atualizações:** `node scripts/assinar-atualizacao.mjs gerar` cria a chave Ed25519 em `%USERPROFILE%\.oracle-desktop\chave-atualizacao.pem` e grava a pública em `src/main/chaveAtualizacao.ts` (já feito nesta máquina). **Faça backup da chave privada** num lugar seguro: sem ela, os apps instalados recusam as próximas atualizações. Em outra máquina, use `ORACLE_CHAVE_ATUALIZACAO=<caminho>`.
- **Conta e token do GitHub:** 2FA com chave física na conta; token *fine-grained* só com `Contents: read and write` no repositório de releases.

A cada versão:

1. Suba a versão em `package.json` (`"version"`).
2. Rode:

```powershell
$env:GH_TOKEN = "<token>"; npm run release
```

O build inteiro roda **sem** o token; só o último passo (envio dos arquivos prontos) o recebe. Vão para o Release do GitHub: o instalador, o `.blockmap`, o `latest.yml` e o manifesto assinado `oracle-atualizacao-<versão>.json`.

O envio é feito por `scripts/publicar-release.mjs` (API do GitHub): cria a release como rascunho, envia os 4 arquivos e só então publica. Se o envio falhar depois de o instalador estar pronto, **não precisa refazer o build** — rode só:

```powershell
npm run publicar
```

(`npm run publicar -- --simular` confere os arquivos e mostra o plano sem enviar nada.)

Os apps instalados verificam ao abrir e a cada 6 h e baixam em segundo plano. **Só oferecem instalar se a assinatura do manifesto for válida e o sha512 bater com o arquivo baixado**; senão recusam e avisam. Banco, sessão e preferências (`%APPDATA%\Oracle`) são preservados.

## Notas

- **Assinatura de código:** o instalador não é assinado; o Windows SmartScreen mostra um aviso na primeira instalação ("Mais informações" → "Executar assim mesmo"). Com um certificado, configure `win.signtoolOptions`/`CSC_LINK` no electron-builder.
- **Fuses do Electron** (em `package.json` → `build.electronFuses`): o app instalado não roda como Node, não aceita `NODE_OPTIONS` nem `--inspect`, só carrega do `app.asar` e valida a integridade dele. Também recusa abrir com depuração remota.
- **Flags recusadas:** o app instalado não abre com flags do Chromium que desligam proteções ou desviam tráfego (depuração remota, proxy, certificados, sandbox… — `FLAGS_RECUSADAS` em `src/main/config.ts`).
- **Desinstalar e apagar os dados:** o desinstalador preserva `%APPDATA%\Oracle` (banco, sessão, preferências, logs). Para apagar tudo, feche o Oracle e remova essa pasta.
- **Pasta de instalação personalizada:** o instalador fecha o Oracle aberto (`--sair`) só na pasta padrão (`%LOCALAPPDATA%\Programs\Oracle`); em outra pasta, feche o Oracle antes de atualizar manualmente.
- **Encerrar pela linha de comando:** `Oracle.exe --sair` fecha o Oracle aberto pelo caminho normal (para a API e o banco). O instalador usa isso antes de atualizar.
