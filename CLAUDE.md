# shinrin

Personal AI language study-assistant app. A SvelteKit web UI on top of a tool-calling
agent loop backed by Ollama (local LLM) and Anki (flashcards), with
Postgres for persistence (sessions, messages, memories, study-topic
progress, mistake logs).

## Stack

- SvelteKit 3 (prerelease — see "SvelteKit 3" section below), Svelte 5 (runes mode,
  remote functions enabled), TypeScript, Tailwind 4
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
- **Subagents**: an agent with `agents.isSubagent = true` can be assigned to
  other agents via the `agent_subagents` join table (`agentId` → `subagentId`,
  both FK'd to `agents`); `agents.remote.ts`'s `computeAncestorIds` walks that
  graph backward to stop cycles at assignment time, both in the UI list
  (`getAssignableSubagents`) and again server-side in `saveAgent`. At runtime
  [toolRegistry.ts](src/lib/server/tools/toolRegistry.ts)'s `getSubagentTools`
  turns each assigned subagent into a
  [SubagentTool](src/lib/server/tools/subagentTool.ts) — a normal `Tool` whose
  `execute()` runs a full nested `Agent.create(...).run(...)` against the
  target agent and returns its final reply as the tool result. A subagent
  runs on its own `agents.defaultModel` if set, otherwise inherits whatever
  model the calling agent is using. Nested runs are not specially persisted —
  they show up as an ordinary tool call/result on the parent, same as any
  other tool.

## Routes

- `src/routes/+page.svelte` — landing page; currently a placeholder
  ("Hello, Shinrin") pending a real dashboard.
- `src/routes/+layout.svelte` — wraps every route in the shadcn-svelte
  sidebar shell (`Sidebar.Provider` / `Sidebar.Inset`) and mounts
  `ModeWatcher` (see UI section below).
- [src/lib/components/app-sidebar.svelte](src/lib/components/app-sidebar.svelte) —
  sidebar nav content (menu items, dark-mode toggle button). Add new nav
  items here.
- `src/routes/chat/` — chat UI, rebuilt on the shadcn-svelte base.
  `src/routes/chat/+page.svelte` is the launcher: agent/model selects +
  message composer to start a new session (`createSession` +
  `runAgent` from [sessions.remote.ts](src/lib/sessions.remote.ts), then
  `goto`'s into it), plus a table of past sessions (`getAllSessions` from
  [agents.remote.ts](src/lib/agents.remote.ts)) to resume one.
  `src/routes/chat/[sessionId]/+page.svelte` is the conversation screen —
  transcript (`getSessionMessages`) + composer (`runAgent`); agent/model are
  shown read-only there since both are fixed per session at creation time
  ([schema.ts](src/lib/server/db/schema.ts) `sessions.agentId`/`model`).
  No streaming yet — submitting shows a pending state (`command.pending`)
  until the full reply resolves; `models.remote.ts` is superseded by
  [ollamaAdmin.remote.ts](src/lib/ollamaAdmin.remote.ts)'s `getAvailableModels`.
- **Markdown rendering** — `src/lib/markdown/` (`parser.ts` +
  `Markdown.svelte`/`MarkdownBlock.svelte`/`MarkdownInline.svelte`) parses a
  constrained markdown subset into a plain node tree and renders it through
  real Svelte elements/text interpolation. Deliberately never uses `{@html}`
  anywhere in the path — message content is untrusted agent/LLM output, and
  this way there's nothing to sanitize because nothing is ever parsed as an
  HTML string. Superseded the old string-returning `src/lib/markdown.ts`
  (deleted) for exactly this reason. See `parser.test.ts` for the supported
  subset (headers, emphasis with CommonMark-style flanking-delimiter rules,
  inline/block code, links with a safe-URL allowlist, lists, blockquotes,
  tables, `hr`).
- Data fetching uses SvelteKit's **remote functions** (`query`/`command` from
  `$app/server`, in `src/lib/*.remote.ts` — e.g.
  [agents.remote.ts](src/lib/agents.remote.ts),
  [sessions.remote.ts](src/lib/sessions.remote.ts)), called directly from
  `.svelte` files (`{#each await getAgents() as ...}`), **not** the
  traditional `+page.server.ts` `load` function. `experimental.remoteFunctions`
  is enabled in the `sveltekit(...)` plugin call in [vite.config.ts](vite.config.ts)
  (see "SvelteKit 3" section below for why it's not in a `svelte.config.js`). Don't
  add a `load` function out of habit — check for a `.remote.ts` file first.
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
- **`query.live` SSR gotcha**: if the generator's _first_ `yield` requires real
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
- **`form()` submit vs result**: inside an `enhance` callback, `await instance.submit()`
  resolves to a `boolean` (did validation succeed) — it does **not** return the server
  function's return value. That's on the `result` getter, which is only populated once
  `submit()` resolves. Don't destructure `{ result }` out of the callback argument up
  front — that reads the getter before submission completes, giving a stale/`undefined`
  value. Read `form.result` _after_ `await form.submit()`.
- A single `form()` can serve create-or-update: make `id` optional in the validation
  schema and branch on its presence inside the handler (insert vs update). Call the
  form directly for create, `.for(id)` for update — `.for()` only exists to key/dedupe
  concurrent instances on the same page (e.g. a list of editable rows), it doesn't
  change handler behavior. See `saveAgent` in [agents.remote.ts](src/lib/agents.remote.ts).
- **bits-ui form components (`Checkbox`, `Select`, ...) don't play well with
  `agentForm.fields.x.as(...)`** — two separate gotchas, both hit in
  [agent-form.svelte](src/routes/agents/agent-form.svelte):
  - They never dispatch real DOM `input`/`change` events on programmatic state
    changes (only on genuine user interaction with their internal hidden
    input), so the remote form's live tracking — `.value()`, `.issues()` —
    which only listens for `input` events on the `<form>`, never updates from
    them. Bind with real Svelte reactivity instead: `bind:checked`/`bind:value`
    into a local `$state`, and set `name` by hand (e.g. `name="b:isSubagent"`
    for a boolean field, matching the `b:`/`n:` prefix convention `.as()` would
    otherwise add) so the value still submits correctly via `FormData` at
    submit time — submission works fine regardless, since `handle_submit`
    always reads the DOM fresh.
  - `.as(...)` also injects a `type` attribute (`"checkbox"`, `"select"`, ...)
    that collides with bits-ui's own same-named, differently-typed `type` prop
    (`Checkbox`'s `type` is `"submit"|"button"`; `Select`'s is
    `"single"|"multiple"`) — so `.as(...)` doesn't type-check on these
    components at all. Set `name`/`checked`/`value` directly instead (see the
    `toolIds[]`/`subagentIds[]` checkboxes for the pattern).
- **`Select.Root`'s bound `value` can never actually be `undefined`** — bits-ui
  force-defaults it to `""` (for `type="single"`) the instant it sees
  `undefined`, and that propagates back through `bind:value`. Don't compute
  trigger/placeholder text from the raw bound value with `??`/`||`; use a
  separate `$derived` lookup instead, matching the current shadcn-svelte docs
  pattern: `list.find((x) => x.value === boundValue)?.label ?? placeholder`
  (see `modelTriggerContent` in [agent-form.svelte](src/routes/agents/agent-form.svelte)) —
  `.find()` genuinely returns `undefined` on no match, so `??` is correct
  _there_, just not against the raw bound value.

## SvelteKit 3

Running `@sveltejs/kit@3.0.0-next.8` + `@sveltejs/adapter-node@6.0.0-next.3` — a
deliberate, early jump onto the prerelease line, not an accident. Both are pinned to
an **exact** version in `package.json` (no `^`) on purpose: bumping across `next.*`
releases should stay a one-at-a-time, deliberate action, not something a routine
`pnpm install` does silently. When bumping, check the actual
[CHANGELOG.md](https://github.com/sveltejs/kit/blob/version-3/packages/kit/CHANGELOG.md)
(note: the repo's default branch is `version-3`, not `main`) for breaking changes
rather than assuming — kit3 has been shedding a lot of long-deprecated APIs release
to release.

- **No `svelte.config.js`/`.ts`** — kit3 throws on startup (`... is no longer used`)
  if either file exists at all. All config (`adapter`, `experimental`, `typescript`,
  `alias`, `compilerOptions`, ...) now goes through the `sveltekit(...)` Vite plugin
  call in [vite.config.ts](vite.config.ts), with the old `kit.*` fields passed as
  flat top-level properties instead of nested under `kit:`. `eslint.config.js` needs
  the same `compilerOptions` (the `runes` function + `experimental.async`) for
  `eslint-plugin-svelte`'s `svelteConfig` parser option and can't import them from
  `svelte.config.js` anymore either — kept as small, deliberately duplicated literals
  in both files rather than a shared module, since a previous shared
  `svelte.compiler-options.js` file seemed to be what confused the IDE's Svelte
  language server (see the `experimental_async` false-positive note below).
- **Env vars are now explicit, not dynamic** — `$env/dynamic/private`,
  `$env/static/private`, etc. are gone (removed from the shipped types entirely, so
  this fails at the TypeScript level, not just at runtime). Declare each var your
  app actually uses in [src/env.ts](src/env.ts) via `defineEnvVars` (from
  `@sveltejs/kit/hooks`), then import the specific named export from
  `$app/env/private` (server-only) or `$app/env/public` — see
  [src/lib/server/db/index.ts](src/lib/server/db/index.ts) for the pattern. Only
  vars actually listed in `src/env.ts` exist as exports; nothing free-form. Values
  still come from `.env.[mode]` the same way as before — this only changes how you
  declare/import them, not where the values live.
- **`+error.svelte` reads `error` as a component prop now, not `page.error`** — kit3
  generates a per-route `ErrorProps = { error: App.Error }` type (from `./$types`),
  and the auto-inserted `<svelte:boundary>` passes the caught error down as a prop
  (`<Error {error} />`), not via the `page` store. `page.error` (`$app/state`)
  reflects the classic `load`-error path and is **not** reliably updated for
  render-time errors caught by a boundary (e.g. a remote function's `error(...)`
  thrown inside `$derived(await ...)`) — using it there is stale/wrong, not just a
  style choice. Do `let { error }: ErrorProps = $props();` and use `error.message`
  directly; see any of the `+error.svelte` files for the pattern.
- **Known upstream bug: error boundaries don't cleanly reset on client-side
  navigation** — [sveltejs/kit#16207](https://github.com/sveltejs/kit/issues/16207),
  root-caused in draft PR
  [#16227](https://github.com/sveltejs/kit/pull/16227). kit3 auto-wraps every route
  that has an `+error.svelte` in a `<svelte:boundary>`, but it's the same boundary
  instance reused across every navigation at that depth, not recreated per route.
  Two bugs compound: Svelte's own `Boundary` class doesn't destroy its previous
  `#main_effect`/`#failed_effect` when the block effect re-runs (any navigation
  triggers this), and there's a race in SvelteKit's async `transformError` step
  where the boundary can re-render _before_ the previous error's transform promise
  resolves, attaching a stale failed-state effect to whatever route you've since
  navigated to. Net effect: once any boundary anywhere has failed once, its old
  error can spuriously reappear on a later, completely unrelated, successful
  navigation — until a hard reload rebuilds the app fresh. Not fixable from app
  code (it's in Svelte's `Boundary` class + kit's error-transform pipeline).
  **Workaround**: [error-empty-state.svelte](src/lib/components/error-empty-state.svelte)'s
  recovery link uses `data-sveltekit-reload={true}` (a real boolean — `="true"` fails
  type-checking, that attribute's type is `boolean | "" | null | undefined`) to force
  a real full-page navigation instead of client-side routing, which sidesteps the bug
  entirely (a fresh app instance has no stale boundary state). Remove that attribute +
  this note once upstream ships a real fix.
- **IDE may falsely report `Cannot use \`await\` in deriveds... unless
  \`experimental.async\` is true`** (svelte.dev/e/experimental_async) even though the
  option is set and the real compiler (Vite dev server, `pnpm build`) is fine with it
  — the Svelte language server can go stale on `experimental.async`'s new home in
  `vite.config.ts`'s `sveltekit(...)` call, same class of issue as the ESLint one
  above. `pnpm run verify` (`check` + `lint`) is the way to confirm whether an error
  is real or just a stale IDE/language-server cache — if `verify` is clean, restart
  the editor's Svelte extension rather than "fixing" code that isn't broken.

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
  don't need it — Vite already loads `.env.[mode]` for the app's own env vars (see
  "SvelteKit 3" section above for how those are declared/imported now).
