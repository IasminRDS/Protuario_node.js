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
RUN apt-get update -y && apt-get install -y openssl

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
