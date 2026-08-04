# Backend beculture (NestJS + Prisma) — imagem única, serve Railway e Render.
FROM node:20-slim

# openssl é exigido pelo engine do Prisma (debian-openssl-3.0.x).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala TODAS as deps (inclui prisma CLI e ts-node, usados em deploy/seed).
COPY package*.json ./
RUN npm ci

# Código + gera o client do Prisma + build do Nest.
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
# A plataforma injeta PORT; o app lê via ConfigService (fallback 3001).
EXPOSE 3001

# A cada boot: aplica migrations pendentes + popula o catálogo de squads
# (seed.ts é upsert, idempotente) e sobe a API. Se o seed falhar, a API
# sobe mesmo assim. (NÃO rode db:seed:memorias aqui — ele apaga memórias.)
CMD ["sh", "-c", "npx prisma migrate deploy && (npm run db:seed || echo 'seed do catalogo falhou, seguindo') && node dist/main.js"]
