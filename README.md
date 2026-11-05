# beculture-product

Monorepo por convivência, não por ferramenta: cinco projetos npm independentes
dividindo um repositório Git. **Não há `package.json` na raiz**, nem workspaces,
nem Turborepo, nem Nx. Cada diretório se instala, roda e publica sozinho.

Este README existe para responder uma pergunta que o repositório sozinho não
responde: **o que aqui é vivo e o que é sobra do kit de UI**. A diferença não
está no código — está no histórico — e confundi-las já levou a detecção
automática da Vercel a propor configuração errada (ver [Vercel
services](#apêndice-vercel-services-avaliado-e-não-adotado)).

## Mapa dos diretórios

| Diretório     | O que é                                  | Projeto Vercel  | Commits |
| ------------- | ---------------------------------------- | --------------- | ------- |
| `ts/api`      | NestJS 11 + Prisma 6 — **a API**         | `beculture-api` | 23      |
| `ts/demo`     | Vite 7 + React 19 — **o produto web**    | `beculture-web` | 45      |
| `js/demo`     | cópia do kit Tailux (JS), não usada      | nenhum          | 1       |
| `js/starter`  | cópia do kit Tailux (JS), não usada      | nenhum          | 1       |
| `ts/starter`  | cópia do kit Tailux (TS), não usada      | nenhum          | 2       |

**Só `ts/api` e `ts/demo` são aplicações reais.** Os outros três entraram na
importação inicial (`3ee389b`, 2026-08-04) e ficaram parados: `js/demo` e
`js/starter` têm o mesmo `name` e a mesma `version` no `package.json`
(`tailux-react-js` 1.3.4), são duas cópias da mesma distribuição, não têm
lockfile nem `node_modules` — nunca foram instalados — e não contêm nenhuma
ocorrência de "beculture" ou "behuman". `ts/starter` recebeu um único ajuste
cosmético de i18n (`f4becba`) e nada mais.

Nenhum dos três tem diretório `.vercel/`: nunca foram ligados a projeto algum.

### Os três `vercel.json` inertes

```
js/demo/vercel.json
js/starter/vercel.json
ts/starter/vercel.json
```

Os três são **byte-idênticos**, vieram prontos do kit e nunca foram editados.
Não correspondem a projeto nenhum na Vercel e não têm efeito sobre nada. Ficam
no lugar por não valer a pena mexer no código de template, mas quem for
configurar deploy deve ignorá-los.

Os `vercel.json` que importam são **`ts/api/vercel.json`** e
**`ts/demo/vercel.json`**, os dois escritos para este projeto no commit
`8ec2493`.

## Desenvolvimento local

```bash
dev.cmd
```

Sobe a API em `:3001` e o web em `:5173`, cada um na sua janela de console.
Requer `npm install` feito nas duas pastas e o Postgres local no ar
(`cd ts/api && npm run db:up`).

Para conferir se a API está viva:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/uso/tokens
```

`401` = viva (a rota existe e pede autenticação). `000` = fora do ar.

## Deploy

**Pela CLI, nunca por push.** Nenhum dos dois projetos tem integração Git
configurada na Vercel — publicar no GitHub não dispara deploy nenhum.

```bash
cd ts/api  && npx vercel --prod --yes
cd ts/demo && npx vercel --prod --yes
```

Publique a **API primeiro**: é o build dela que aplica as migrations.

| Projeto         | URL de produção                      |
| --------------- | ------------------------------------ |
| `beculture-api` | https://beculture-api.vercel.app     |
| `beculture-web` | https://beculture-web.vercel.app     |

Não há domínio próprio configurado na conta — os dois rodam em `*.vercel.app`.

### O que um deploy da API faz com o banco

O `vercel-build` de `ts/api/package.json` encadeia, nesta ordem:

```
prisma generate && prisma migrate deploy
  && (npm run db:seed              || echo 'seed do catalogo falhou, seguindo')
  && (npm run db:seed:demo         || echo 'seed da conta demo falhou, seguindo')
  && (npm run db:seed:demo:membros || echo '...')
  && (npm run db:seed:demo:estrutura || echo '...')
  && nest build
```

Duas consequências que vale saber antes de apertar o botão:

- **Um seed que falha não derruba o deploy.** Cada um está embrulhado em
  `|| echo`, então o build fica verde e o erro some no log. Ao acompanhar um
  deploy, procure por `falhou, seguindo`.
- **`db:seed:demo` redefine a senha de `demo@beculture.ai`** e reinicia o trial.
  Se alguém trocou essa senha pela interface, o deploy reverte em silêncio.

## Como o front encontra a API

O front lê **`VITE_API_URL`** num único ponto, `ts/demo/src/configs/auth.ts:7`:

```ts
export const JWT_HOST_API: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001";
```

Em produção o valor vem de `ts/demo/.env.production`, que **é versionado** (ao
contrário do resto dos `.env*`) porque o build da Vercel precisa dele. Em
desenvolvimento não existe `.env` algum: vale o fallback `localhost:3001`.

**Não há proxy no Vite.** O navegador fala com a API cross-origin sempre, em dev
e em produção — por isso o CORS importa em toda requisição. A decisão de origem
está em `ts/api/src/bootstrap.ts` e aceita três caminhos: a lista exata de
`CORS_ORIGIN`, qualquer porta de `localhost` quando `CORS_ALLOW_LOCALHOST` está
ligado (o padrão é desligado em qualquer deploy Vercel), ou um host `https` que
termine em `CORS_VERCEL_SUFFIX` (padrão `-beculture.vercel.app`).

Uma armadilha conhecida: **um CORS barrado é indistinguível de API fora do ar**
para o usuário. O interceptor em `ts/demo/src/utils/axios.ts:11-28` trata os
dois casos pelo mesmo caminho ("Servidor indisponível") e joga o app em sessão
local. Ao investigar "a API não responde", descarte CORS antes de procurar outra
causa.

---

## Apêndice: Vercel services, avaliado e não adotado

A detecção automática da Vercel propõe um `vercel.json` na raiz transformando os
cinco diretórios em *services* de um projeto único. **Isso foi avaliado e
recusado** — os dois projetos separados permanecem. O registro fica aqui para a
análise não se perder e para a próxima sugestão automática não parecer novidade.

**Os quatro erros da sugestão automática**, todos verificados:

1. Inclui `js/demo`, `js/starter` e `ts/starter`, que são código morto — três
   builds a mais por deploy, de código que ninguém usa.
2. Os nomes propostos `demo-2` e `starter-2` seriam **rejeitados**: o schema
   exige `^[a-z]([a-z_-]*[a-z])?$` e não aceita dígitos.
3. O roteamento vem invertido — com `/(.*)` → `api` como única rewrite, os
   frontends ficariam sem rota pública e o app web, inalcançável.
4. `"framework": "nestjs"` provavelmente quebraria a API. O deploy atual usa um
   entrypoint próprio, `ts/api/api/index.js`, que importa o `dist/` do
   `nest build` justamente porque o esbuild do `@vercel/node` não emite metadata
   de decorators — sem ela, a injeção de dependências do Nest cai.

**Nenhum `binding` se aplica a este repositório.** Bindings servem para um
service chamar outro pela rede interna, e aqui não existe chamada
servidor-a-servidor: `ts/demo` é SPA estática pura (sem `api/`, sem middleware,
sem SSR) e quem chama a API é o navegador; a API só chama terceiros (Microsoft
Graph, Google, Slack). Mesmo que houvesse, não ajudaria o front: a documentação
é explícita — bindings resolvem **apenas em tempo de execução, dentro de
functions, e nunca durante builds** — e `VITE_API_URL` é embutido no bundle em
tempo de build.

Se um dia a migração for feita, esta é a configuração correta:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "services": {
    "web": {
      "root": "ts/demo",
      "framework": "vite",
      "buildCommand": "npm run build",
      "outputDirectory": "dist"
    },
    "api": {
      "root": "ts/api",
      "buildCommand": "npm run vercel-build",
      "outputDirectory": "public",
      "functions": {
        "api/index.js": {
          "maxDuration": 300,
          "includeFiles": "{dist/**,node_modules/.prisma/client/**,node_modules/@prisma/client/**}"
        }
      },
      "routes": [
        {
          "src": "/api/(.*)",
          "transforms": [{ "type": "request.path", "op": "set", "args": "/$1" }]
        }
      ]
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": { "service": "api" } },
    { "source": "/(.*)", "destination": { "service": "web" } }
  ]
}
```

Por que cada peça está assim:

- **O `request.path` não é opcional.** Uma rewrite pública para `/api/...`
  entrega ao service o **caminho original** (`/api/uso/tokens`), mas o Nest
  serve na raiz (`/uso/tokens`) — não há `setGlobalPrefix` em lugar nenhum do
  `ts/api`. O transform corrige o caminho que o código enxerga sem tocar no Nest.
- **`framework` fica omitido na API**, de propósito, para preservar o entrypoint
  próprio descrito acima.
- **O catch-all vem por último** e é o front; roteamento para dentro de um
  service é final, sem fallback para as outras rewrites.
- **O ganho seria o fim do CORS**: mesma origem, e `VITE_API_URL` passaria a ser
  `/api`. Dada a armadilha descrita acima, não é pouco.
- **O custo**: services é Beta; a CLI instalada aqui (58.5.1) não expõe o
  recurso; as 24 variáveis de produção da API teriam de migrar para o projeto
  consolidado; e o host da API mudaria, o que quebraria os callbacks de OAuth
  registrados nos consoles de Google, Slack e Microsoft.

Documentação: https://vercel.com/docs/services
