# ---- Build stage ----
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build && ls -la dist

# ---- Runtime stage ----
FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]