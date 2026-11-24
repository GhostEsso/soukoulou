# API NestJS. Contexte de build : la racine du monorepo (voir docker-compose.prod.yml).
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable && corepack prepare pnpm@10.12.1 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
# ponytail: dépendances de dev gardées dans l'image (ts-node sert au seed). Image multi-étapes si la taille gêne.
RUN pnpm install --frozen-lockfile --filter api...
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN npx prisma generate && pnpm build
ENV NODE_ENV=production
EXPOSE 4000
# Migrations non destructives à chaque démarrage, puis l'API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
