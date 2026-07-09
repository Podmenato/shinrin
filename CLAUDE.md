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

- `src/routes/+page.svelte` — landing page; currently a placeholder
  ("Hello, Shinrin") pending a real dashboard.
- `src/routes/+layout.svelte` — wraps every route in the shadcn-svelte
  sidebar shell (`Sidebar.Provider` / `Sidebar.Inset`) and mounts
  `ModeWatcher` (see UI section below).
- [src/lib/components/app-sidebar.svelte](src/lib/components/app-sidebar.svelte) —
  sidebar nav content (menu items, dark-mode toggle button). Add new nav
  items here.
- The chat UI (previously `src/routes/chat/[sessionId]/`) was torn down and
  is pending a rebuild on the shadcn-svelte base; the remote functions it
  used ([sessions.remote.ts](src/lib/sessions.remote.ts),
  [agents.remote.ts](src/lib/agents.remote.ts),
  [models.remote.ts](src/lib/models.remote.ts)) and
  [markdown.ts](src/lib/markdown.ts) are unused right now but left intact
  for that rebuild.
- Data fetching uses SvelteKit's **remote functions** (`query`/`command` from
  `$app/server`, in `src/lib/*.remote.ts` — e.g.
  [agents.remote.ts](src/lib/agents.remote.ts),
  [sessions.remote.ts](src/lib/sessions.remote.ts)), called directly from
  `.svelte` files (`{#each await getAgents() as ...}`), **not** the
  traditional `+page.server.ts` `load` function. `kit.experimental.remoteFunctions`
  is enabled in [svelte.config.js](svelte.config.js) for this. Don't add a
  `load` function out of habit — check for a `.remote.ts` file first.
- `src/routes/ollama/` — Ollama admin page (downloaded/running models, stop a
  running model). Talks to the local Ollama daemon directly via
  [src/lib/server/ollamaAdmin.ts](src/lib/server/ollamaAdmin.ts) — intentionally
  not routed through `ModelProvider`, since it's inherently Ollama-specific
  admin/management, not a chat-provider concern. See "Remote functions" below
  for the `query.live` pattern this page uses.

## Remote functions

- Regular `query()`/`command()` (see above) expose `.refresh()`. `query.live()`
  is a separate, streaming variant: it takes an async generator function, and the
  connection it opens server-side only stays alive while a client is actively
  subscribed (closes on navigation/tab close — no orphaned polling). Client-side
  it exposes `.connected` / `.done` / `.reconnect()` instead — there is no
  `.refresh()` on a live query.
- First (and so far only) usage:
  [src/lib/ollamaAdmin.remote.ts](src/lib/ollamaAdmin.remote.ts) streams Ollama's
  models (via [src/lib/server/ollamaAdmin.ts](src/lib/server/ollamaAdmin.ts)),
  polling every 5s server-side for as long as `src/routes/ollama/` has a client
  connected.
- **`query.live` SSR gotcha**: if the generator's *first* `yield` requires real
  async I/O (e.g. `yield await someFetch()`), there's a race between that promise
  resolving and SvelteKit serializing the SSR response. Losing that race throws
  `hydratable_missing_but_required` during hydration — **in dev mode this is a
  hard error that aborts hydration for the whole page**, not just the affected
  component (in production it's just a console warning + graceful fallback).
  Fix: `yield` a synchronous placeholder first (e.g. `yield null;`) before the
  `while (true)` polling loop, so the hydration snapshot always resolves
  instantly and never loses the race. In the UI, distinguish "not loaded yet"
  (`null`) from "genuinely empty" (real `[]`) with an explicit `== null` check —
  don't use `?? []`/truthiness, or the two states get conflated.
- Any `query()`/`query.live()` call is cached by function id + serialized args —
  calling the same remote function from multiple components (e.g. a page and a
  child component) shares the same underlying reactive resource automatically.
  Prefer calling the query directly wherever it's needed over prop-drilling it.
- Don't pass a query's method as a bare prop (`refresh={models.refresh}`) — it's
  a real class instance method and loses its `this` binding when detached like
  that. Wrap it (`refresh={() => models.refresh()}`) or otherwise always call it
  as a method, never as a bare reference.

## UI / components

- Component library is **shadcn-svelte** (built on `bits-ui`). Installed
  components live in `src/lib/components/ui/*` (e.g. `button`, `card`,
  `sidebar`, `select`, `field`, `empty`, `spinner`, ...). When a screen
  needs a component that isn't there yet, prefer pulling it from
  shadcn-svelte (`pnpm dlx shadcn-svelte@latest add <name>` — check
  https://www.shadcn-svelte.com/docs/components for the current name/list
  rather than guessing) over hand-rolling markup.
- Theme colors are CSS custom properties in
  [src/routes/layout.css](src/routes/layout.css) (OKLCH, `:root` + `.dark`)
  — a custom "forest" green palette, not shadcn's default neutral one.
  Config metadata (base color, style, aliases) is in
  [components.json](components.json).
- Dark mode uses the `mode-watcher` package, not hand-rolled state:
  `<ModeWatcher />` is mounted once in `+layout.svelte` (handles the
  pre-hydration class script + `localStorage` persistence); `toggleMode()` /
  `mode.current` from `mode-watcher` are used elsewhere (see
  [app-sidebar.svelte](src/lib/components/app-sidebar.svelte)).
- Icons are `@lucide/svelte`, imported per-icon, e.g.
  `import HouseIcon from '@lucide/svelte/icons/house'`.

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
