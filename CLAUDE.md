# shinrin

Personal AI language study-assistant app. A SvelteKit web UI on top of a tool-calling
agent loop backed by Ollama (local LLM) and Anki (flashcards), with
Postgres for persistence (sessions, messages, memories, study-topic
progress, mistake logs).

## Stack

- SvelteKit 2 (Svelte 5, runes mode, remote functions enabled), TypeScript, Tailwind 4
- Postgres via `drizzle-orm`/`postgres-js`, schema in [src/lib/server/db/schema.ts](src/lib/server/db/schema.ts)
- Ollama as the model provider (local, `http://localhost:11434`)
- Anki access via AnkiConnect (tools under `src/lib/server/tools/anki/`)
- `pino` for logging
- Package manager: **pnpm** (not npm/yarn — see `pnpm-workspace.yaml`, `.npmrc engine-strict=true`)

## How the agent works

- [src/lib/server/agent.ts](src/lib/server/agent.ts) — `Agent` class: the
  run loop that talks to a `ModelProvider`, executes tool calls, and persists
  turns via `ContextManager`. Max 7 iterations per `run()`.
- [src/lib/server/contextManager.ts](src/lib/server/contextManager.ts) —
  builds the message list sent to the model and persists messages/tool calls
  to Postgres (`messages`, `message_tool_calls` tables).
- [src/lib/server/modelProviders/](src/lib/server/modelProviders/) —
  `ModelProvider` interface; `OllamaProvider` is the current implementation.
- [src/lib/server/tools/toolRegistry.ts](src/lib/server/tools/toolRegistry.ts) —
  maps tool names (as stored in the `tools` DB table / an agent's
  `agent_tools`) to `Tool` implementations. Some tools are contextual
  (need `agentId`), e.g. memory/progress/mistake tools.
- DB rows drive config: an `agents` row defines a system prompt and which
  tools it has (via `agent_tools`); a `sessions` row is one conversation
  with a chosen model; `memories` / `study_topics` / `mistake_observations`
  are per-agent persistent state the agent writes to itself via tools.
- [src/lib/server/db/seed.ts](src/lib/server/db/seed.ts) currently seeds two
  example agents (Japanese, Mandarin language tutors) with prompts and tool
  assignments — this is example/dev content, not fixed product config.

## Routes

- `src/routes/+page.svelte` — landing page, lists sessions.
- `src/routes/chat/[sessionId]/` — chat UI for a session.
- `src/routes/demo/` — scaffold demo pages from `sv create`, not part of the app.
- Data fetching uses SvelteKit's **remote functions** (`query`/`command` from
  `$app/server`, in `src/lib/*.remote.ts` — e.g.
  [agents.remote.ts](src/lib/agents.remote.ts),
  [sessions.remote.ts](src/lib/sessions.remote.ts)), called directly from
  `.svelte` files (`{#each await getAgents() as ...}`), **not** the
  traditional `+page.server.ts` `load` function. `kit.experimental.remoteFunctions`
  is enabled in [svelte.config.js](svelte.config.js) for this. Don't add a
  `load` function out of habit — check for a `.remote.ts` file first.

## Dev commands (use pnpm)

- `pnpm dev` / `pnpm dev-debug` / `pnpm dev-trace` — runs [scripts/dev.ts](scripts/dev.ts).
  If `DB_WIPE_ON_START=true` (set in `.env.development`, default on) it first
  drops and recreates the `public` schema, then always does
  `drizzle-kit push --force` (schema sync straight from
  [schema.ts](src/lib/server/db/schema.ts), no migration files) + seeds the
  dev DB, then runs `vite dev`. Stopping it does nothing to the DB — the wipe
  only happens on the next start. Dev intentionally has no migration files at
  all — they were a source of friction when the data didn't matter anyway;
  see `db:prod:*` below for the real migration flow.
  The `-debug`/`-trace` variants set `LOG_LEVEL` for `pino` (default level is
  `info`, see [src/lib/server/logger.ts](src/lib/server/logger.ts)).
  Requires the dev DB container to already be running (`pnpm db:dev:start`,
  started manually in another terminal — docker lifecycle is never automatic).
- `pnpm build` then `pnpm start` — production build/run. `start` loads
  `.env.production` via Node's `--env-file` and does **not** seed or clean.
- `pnpm db:dev:start` / `pnpm db:prod:start` — `docker compose up` against
  [compose.dev.yaml](compose.dev.yaml) / [compose.prod.yaml](compose.prod.yaml)
  (separate ports/volumes/db names, see `.env.development` / `.env.production`).
- `pnpm db:dev:push` / `db:dev:studio` / `db:dev:seed` / `db:dev:clean` — dev
  DB tools; `push` is also what `scripts/dev.ts` calls automatically.
- `pnpm db:prod:generate` / `db:prod:migrate` / `db:prod:studio` — real
  versioned migrations against prod (via
  [drizzle.config.prod.ts](drizzle.config.prod.ts)) — no prod push/seed/clean
  scripts exist on purpose, prod schema changes should go through reviewed
  migration files.
- `pnpm check`, `pnpm lint`, `pnpm format`, `pnpm test` (vitest + playwright).

## Environment

- Per-mode env files following Vite's `.env.[mode]` convention:
  `.env.development` / `.env.production` (gitignored, real values) with
  `.env.development.example` / `.env.production.example` as committed
  templates. Each carries `DATABASE_URL` plus the `POSTGRES_*` vars used to
  parameterize the matching compose file, so app and docker credentials stay
  in one place. Dev is Postgres on `:5432`/db `shinrin`; prod is `:5433`/db
  `shinrin_prod` so both can run side by side.
- [src/lib/server/env.ts](src/lib/server/env.ts) — `loadEnv(mode)` loads the
  right `.env.[mode]` file for anything that runs outside Vite (drizzle
  configs, seed, clean, `scripts/dev.ts`). SvelteKit's own dev/build/preview
  don't need it — Vite already loads `.env.[mode]` for `$env/dynamic/private`.
