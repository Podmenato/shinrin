# shinrin

Shinrin (森林, "forest") is a personal language-study assistant: a SvelteKit
UI on top of a tool-calling agent loop, running against a local LLM via
Ollama, with Anki as its flashcard backend and Postgres for persistence
(sessions, messages, memories, per-language study progress, mistake logs).

It's a from-scratch alternative to generic chatbot-based studying — instead
of a stateless chat window, the agent has tools to read and write durable
per-subject state (topics you're working on, mistakes you keep making) across
sessions, plus direct access to your real Anki collection instead of just
talking *about* flashcards.

It's also a personal project for learning how to build agentic systems
end-to-end — the architecture choices (tool registry, subagents, contextual
tools, remote functions) are as much about exploring that space as they are
about shipping a study app. See [CLAUDE.md](CLAUDE.md) for the full
architecture rundown.

## Where this is headed

Working end-to-end today: chat with a language-tutor agent backed by Ollama,
tool access to Anki, persistent per-agent memory, and subagents (an agent can
delegate to another agent as a tool call).

Under consideration / in progress:

- **Article reading & discovery** — feed the agent a webpage and have it help
  with vocab/grammar, then quiz you on it; eventually have it surface
  articles matching your current level on its own.
- **Quiz generation** — agent-authored quizzes with graded, tracked results.
- **Handwriting/kanji practice** — a canvas UI where a vision model grades
  stroke input.
- **Work-session logging via MCP → roleplay practice** — expose an MCP
  server from Shinrin (e.g. `logWorkSession`) that a separate Claude Code
  session can call after a work day to log what was done; the tutor agent
  then uses that log as material for Japanese-workplace roleplay practice —
  describing real engineering work in the vocab/register you'd actually need.
- A continuing **frontend overhaul** on shadcn-svelte, and general agent-loop
  improvements (streaming, tool-call visibility, multi-provider support).

None of the above is committed to a timeline — this is a side project that
grows as time and interest allow.

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
