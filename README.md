# shinrin

Shinrin (森林, "forest") is a personal language-study assistant: a SvelteKit
UI on top of a tool-calling agent loop, running against a local LLM via
Ollama, with Anki as its flashcard backend and SQLite for persistence
(sessions, messages, memories, per-language study progress, mistake logs).

It's a from-scratch alternative to generic chatbot-based studying — instead
of a stateless chat window, the agent has tools to read and write durable
per-subject state (topics you're working on, mistakes you keep making) across
sessions, plus direct access to your real Anki collection instead of just
talking _about_ flashcards.

It's local-first and single-user: no account, no hosted service — everything
runs against your own Ollama instance and Anki collection, persisted to one
SQLite file. There's no packaged installer; running it means cloning the
repo and running it from source (see "Setup" below), and it assumes you
already have Ollama and Anki set up.

## Features

- Chat with a language-tutor agent that has persistent per-agent memory and
  direct tool access to your Anki collection (search, add notes, and more)
  via AnkiConnect.
- Subagents — an agent can delegate to another agent as a tool call (e.g. a
  general tutor delegating Anki-specific work to a dedicated Anki agent).
- Article reading — paste a URL and the agent fetches and reads it
  (`fetch_url`) for vocab/grammar help grounded in real text.
- Agent-authored quizzes (`present_quiz`), rendered and graded inline in the
  chat.
- Stories — durable, revisitable content (a saved article, a roleplay
  transcript, a logged work session) the agent can read and write,
  independent of which language you're studying it in.
- An MCP server (`pnpm mcp:server`) exposing a `save_story` tool, so external
  MCP clients (Claude Code, Claude Desktop) can hand content into shinrin
  directly.

## Setup

Prerequisites: Node 26, pnpm, a locally-running Ollama
(`http://localhost:11434`, with at least one model pulled), and Anki running
with the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on
installed.

```sh
pnpm install
cp .env.development.example .env.development
```

The db is just a local SQLite file, one per environment
(`.data/dev.sqlite3` / `.data/prod.sqlite3`, both gitignored) — no DB server
or container to run, and no connection string to configure.

## Developing

```sh
pnpm dev   # or dev-debug / dev-trace for LOG_LEVEL=debug/trace
```

`pnpm dev` runs [scripts/dev.ts](scripts/dev.ts), which:

1. If `DB_WIPE_ON_START=true` in `.env.development` (the default), deletes
   the sqlite db file — every dev session starts from a known, empty state.
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

Production is a separate sqlite file you actually want to keep — no push, no
seed, no auto-wipe. Schema changes go through reviewed migration files
instead of a direct schema sync:

```sh
pnpm db:prod:generate                   # generate a migration from schema.ts changes
pnpm db:prod:migrate                    # apply migrations
pnpm build && pnpm start                # build and run the app itself
```

`pnpm start` runs `NODE_ENV=production node build` — plain adapter-node
output, no Dockerfile or DB container involved, and no `.env.production`
file needed (production needs no configuration beyond `NODE_ENV` itself).
