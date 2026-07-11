# =============================================================================
# Build da API a partir da RAIZ do monorepo (npm workspaces).
#
# Por que na raiz: o repositório usa `workspaces: [backend, frontend]`, então o
# ÚNICO package-lock.json mantido pelo npm é o da raiz. Buildar a partir de
# `backend/` (contexto antigo) usava um backend/package-lock.json ÓRFÃO e
# desatualizado -> `npm ci` falhava e a imagem ficava presa numa versão velha
# ("código ≠ Docker"). Aqui usamos o lock da raiz -> build reprodutível.
# =============================================================================

# ---- Build stage ----
FROM node:20-slim AS builder
WORKDIR /repo
RUN apt-get update -y && apt-get install -y openssl python3 make g++

# Manifests primeiro (cache de camadas). O npm ci exige os package.json de
# TODOS os workspaces declarados no lock.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

# Instala exatamente o que está no lock da raiz (determinístico).
RUN npm ci

# Código do backend + geração do Prisma Client + build.
COPY backend ./backend
RUN npm run -w backend prisma:generate \
 && npm run -w backend build

# ---- Runtime stage ----
FROM node:20-slim AS runner
WORKDIR /repo
ENV NODE_ENV=production
# openssl: exigido pelo Prisma. postgresql-client-16: fornece `pg_dump` para o
# endpoint de BACKUP (o backup falha com 503 sem ele). A versão do client DEVE
# ser >= a do servidor (Postgres 16), por isso usamos o repositório oficial PGDG
# em vez do postgresql-client (v15) do Debian bookworm.
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates gnupg curl lsb-release \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update -y \
 && apt-get install -y --no-install-recommends postgresql-client-16 \
 && rm -rf /var/lib/apt/lists/*

# Carrega as deps já resolvidas + o Prisma Client gerado do builder. Em npm
# workspaces o client pode ficar em node_modules da raiz OU do workspace, então
# copiamos ambas as árvores (robusto, sem adivinhar a localização de hoisting).
COPY --from=builder /repo/package.json /repo/package-lock.json ./
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/backend ./backend

WORKDIR /repo/backend
EXPOSE 3000
# migrate deploy garante que o SCHEMA do banco acompanha o código no deploy.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
