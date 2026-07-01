# shinrin

A personal language-study assistant: a SvelteKit UI over a tool-calling agent
loop backed by Ollama and Anki, with Postgres for sessions/messages/memories.
See [CLAUDE.md](CLAUDE.md) for an architecture overview.

## Setup

```sh
pnpm install
cp .env.development.example .env.development
cp .env.production.example .env.production   # only needed once you actually deploy
```

The `.env.*` files hold both the app's `DATABASE_URL` and the `POSTGRES_*`
vars used to configure the matching docker-compose file, so app and DB
credentials stay in one place per environment. Dev defaults to Postgres on
`:5432`/db `shinrin`; prod to `:5433`/db `shinrin_prod`, so both can run on
the same machine if needed.

## Developing

Docker lifecycle is always manual — start the dev DB yourself in one
terminal, then run the app in another:

```sh
pnpm db:dev:start   # docker compose up, compose.dev.yaml
pnpm dev             # or dev-debug / dev-trace for LOG_LEVEL=debug/trace
```

`pnpm dev` runs [scripts/dev.ts](scripts/dev.ts), which:

1. If `DB_WIPE_ON_START=true` in `.env.development` (the default), drops and
   recreates the `public` schema — every dev session starts from a known,
   empty state.
2. Runs `drizzle-kit push --force` against [schema.ts](src/lib/server/db/schema.ts)
   to (re)create the tables. There are **no migration files in dev** — they
   were pure friction when the underlying data got wiped on every session
   anyway. Set `DB_WIPE_ON_START=false` locally if you'd rather keep data
   across restarts.
3. Seeds the DB ([seed.ts](src/lib/server/db/seed.ts)).
4. Starts `vite dev`.

Stopping the dev server (Ctrl+C) doesn't touch the database — the next wipe
happens on the _next_ `pnpm dev`, not on exit.

Other dev DB commands: `pnpm db:dev:push`, `db:dev:studio`, `db:dev:seed`,
`db:dev:clean` (manual reset without restarting the dev server).

## Production

Production is a separate, real Postgres you actually want to keep — no push,
no seed, no auto-wipe. Schema changes go through reviewed migration files
instead of a direct schema sync:

```sh
pnpm db:prod:start                      # docker compose up, compose.prod.yaml
pnpm db:prod:generate                   # generate a migration from schema.ts changes
pnpm db:prod:migrate                    # apply migrations
pnpm build && pnpm start                # build and run the app itself
```

`pnpm start` runs `node --env-file=.env.production build`, i.e. plain
adapter-node output — there's no app Dockerfile, only the two Postgres
compose files.
