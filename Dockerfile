## Builder stage
FROM node:26.8.2-alpine3.24 AS builder
WORKDIR /app

RUN npm install -g pnpm@11.1.3

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

## Runtime stage
FROM node:26.8.2-alpine3.24
WORKDIR /app

RUN npm install -g pnpm@11.1.3

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# remove dev stuff
RUN pnpm install --frozen-lockfile --prod --ignore-scripts \
	&& rm -rf ~/.local/share/pnpm ~/.cache/pnpm ~/.local/state/pnpm

COPY --from=builder /app/build ./build
COPY drizzle ./drizzle
COPY scripts ./scripts

COPY src/lib ./src/lib

ENV NODE_ENV=production
EXPOSE 4287

CMD ["sh", "-c", "node scripts/migrate.js && node scripts/server.js"]
