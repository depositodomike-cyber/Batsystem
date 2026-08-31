# beculture API

Backend do beculture — **NestJS + Prisma + PostgreSQL**.

Milestone 1 (fundação): autenticação JWT, multi-tenant (empresas/usuários/convites)
e billing (trial de 14 dias, pronto para integrar a Iugu). A IA/squads entra numa
fase seguinte.

## Pré-requisitos

- Node 20+
- Docker (para o Postgres local) — ou um Postgres acessível via `DATABASE_URL`.

## Setup

```bash
cd ts/api
cp .env.example .env          # ajuste JWT_SECRET em produção
npm install
npm run db:up                 # sobe o Postgres (docker compose)
npm run prisma:migrate        # cria as tabelas (primeira vez: nomeie a migration)
npm run start:dev             # API em http://localhost:3001
```

## Endpoints (Milestone 1)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/login` | — | `{ username, password }` → `{ authToken, user }` |
| `GET`  | `/user/profile` | Bearer | `{ user }` |
| `POST` | `/cadastro` | — | Cria empresa + owner + trial → `{ empresa, usuario, assinatura, authToken }` |
| `GET`  | `/cadastro/email-disponivel?email=` | — | `{ disponivel }` |
| `GET`  | `/empresa` | Bearer | Dados do tenant atual |
| `GET`  | `/empresa/convites` | Bearer | Lista convites do tenant |
| `POST` | `/empresa/convites` | Bearer | `{ emails[], role? }` |
| `DELETE` | `/empresa/convites/:id` | Bearer | Remove convite |
| `POST` | `/empresa/onboarding/concluir` | Bearer | Marca onboarding concluído |
| `GET`  | `/health` | — | Health check |

## Servidor MCP (conectores)

A API expõe um servidor **MCP (Model Context Protocol)** em `POST /mcp`
(transporte Streamable HTTP, stateless) para clientes externos — Claude,
Claude Code, Cursor, VS Code etc. — gerenciarem os conectores da empresa.

**Autenticação**: API key por empresa, enviada em `Authorization: Bearer
bcl_mcp_...` (ou no header `x-api-key`, para clientes sem suporte a Bearer).
As chaves são geradas pelo app (somente admin/owner) e armazenadas como
hash SHA-256 — a chave crua só aparece uma vez, na criação.

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/mcp` | API key MCP | Endpoint MCP (JSON-RPC via Streamable HTTP) |
| `GET`  | `/mcp/keys` | Bearer (JWT) | Lista as chaves MCP da empresa |
| `POST` | `/mcp/keys` | Bearer (JWT, admin) | `{ nome }` → cria chave (retorna `key` uma única vez) |
| `DELETE` | `/mcp/keys/:id` | Bearer (JWT, admin) | Revoga a chave |
| `GET`  | `/conectores` | Bearer (JWT) | Catálogo + estado de conexão do tenant |
| `POST` | `/conectores/:id/conectar` | Bearer (JWT) | Ativa um conector |
| `DELETE` | `/conectores/:id` | Bearer (JWT) | Desativa um conector |

**Ferramentas MCP** (todas escopadas à empresa dona da chave):
`listar_categorias`, `listar_conectores`, `obter_conector`,
`conectar_conector`, `desconectar_conector`.

Exemplo de configuração no cliente (Claude Code):

```bash
claude mcp add --transport http beculture https://api.suaempresa.com.br/mcp \
  --header "Authorization: Bearer bcl_mcp_SUACHAVE"
```

Ou no `mcpServers` de outros clientes:

```json
{
  "mcpServers": {
    "beculture": {
      "type": "http",
      "url": "https://api.suaempresa.com.br/mcp",
      "headers": { "Authorization": "Bearer bcl_mcp_SUACHAVE" }
    }
  }
}
```

> Conectores no claude.ai (web) exigem OAuth 2.1 no servidor MCP — fase
> futura; com API key já funcionam Claude Code, Cursor, VS Code e a API.

### Conector Slack (integração real, piloto)

O Slack é o primeiro conector com OAuth de verdade: "Conectar" no app
redireciona para o consentimento do Slack e o bot token fica criptografado
por tenant. Com o Slack autorizado, o servidor MCP ganha as ferramentas
`slack_listar_canais` e `slack_enviar_mensagem` (operam no workspace real).

Setup (uma vez, dono da plataforma):

1. Crie um app em <https://api.slack.com/apps> ("From scratch").
2. Em **OAuth & Permissions → Scopes (Bot Token)** adicione:
   `channels:read`, `chat:write`, `chat:write.public`, `users:read`.
3. Em **Redirect URLs** cadastre a URL do callback. O Slack exige HTTPS —
   em dev local use um túnel (`ngrok http 3001`) e cadastre
   `https://<tunel>/conectores/slack/callback`.
4. Copie **Client ID** e **Client Secret** para `SLACK_CLIENT_ID` /
   `SLACK_CLIENT_SECRET` no `.env` (e ajuste `SLACK_REDIRECT_URL` para a
   mesma URL cadastrada). `FRONT_URL` aponta de volta para o app.

Rotas: `GET /conectores/slack/autorizar` (JWT → `{ url }` de consentimento)
e `GET /conectores/slack/callback` (público; redireciona ao app com
`?slack=ok|erro`).

## Ligar o frontend

Dois terminais. Nada a editar no código: o front, em dev, já usa
`http://localhost:3001` como padrão (`ts/demo/src/configs/auth.ts`), e não precisa
de `VITE_API_URL` — essa variável só existe para o build de produção
(`ts/demo/.env.production`).

```bash
# terminal 1 — banco e API
cd ts/api
npm run db:up                 # Postgres via docker compose
npm run start:dev             # API em http://localhost:3001

# terminal 2 — frontend
cd ts/demo
npm run dev                   # Vite; se 5173 estiver ocupada ele usa 5174, 5175…
```

A API precisa estar de pé **antes** de usar a app: sem ela, toda chamada volta sem
resposta HTTP e a interface mostra "A API não respondeu em http://localhost:3001".
Para conferir: `curl http://localhost:3001/health` → `{"status":"ok"}`.

A porta que o Vite escolher não importa para o CORS: fora da Vercel a API aceita
qualquer porta de `localhost`/`127.0.0.1`. Num deploy isso fica desligado
automaticamente (`CORS_ALLOW_LOCALHOST`, em `src/bootstrap.ts`).

## Próximos passos

- Migrar para a Iugu: implementar os `// TODO(iugu)` em `src/billing/billing.service.ts`.
- Persistir chats/projects/documents (hoje em localStorage no front).
- Squads de IA.
