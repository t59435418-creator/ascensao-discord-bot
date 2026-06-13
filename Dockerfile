FROM node:24-slim AS base

RUN npm install -g pnpm@10

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./

COPY lib/db/package.json ./lib/db/
COPY lib/db/tsconfig.json ./lib/db/
COPY lib/db/drizzle.config.ts ./lib/db/
COPY lib/db/src ./lib/db/src

COPY artifacts/discord-bot/package.json ./artifacts/discord-bot/
COPY artifacts/discord-bot/tsconfig.json ./artifacts/discord-bot/
COPY artifacts/discord-bot/src ./artifacts/discord-bot/src

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["./start.sh"]
