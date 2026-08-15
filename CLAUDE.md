# shinrin

Personal AI language study-assistant app. A SvelteKit web UI on top of a tool-calling
agent loop backed by Ollama (local LLM) and Anki (flashcards), with
SQLite for persistence (sessions, messages, memories, study-topic
progress, mistake logs) — chosen specifically because the app is headed
toward an eventual Electron packaging, where a single embedded db file beats
running a separate server process (see "Database" section below).

## Stack

- SvelteKit 3 (prerelease — see "SvelteKit 3" section below), Svelte 5 (runes mode,
  remote functions enabled), TypeScript, Tailwind 4
- SQLite via `drizzle-orm`/`better-sqlite3`, schema in [src/lib/server/db/schema.ts](src/lib/server/db/schema.ts)
- Ollama as the model provider (local, `http://localhost:11434`)
- Anki access via AnkiConnect (tools under `src/lib/server/tools/anki/`)
- `pino` for logging
- Package manager: **pnpm** (not npm/yarn — see `pnpm-workspace.yaml`, `.npmrc engine-strict=true`)

## Database

Migrated from Postgres to SQLite (`better-sqlite3`) — driven by the Electron
plan, not a preference swap: there's no way to bundle a real Postgres server
inside a desktop app, and a single embedded db file is exactly the shape
Electron wants (`app.getPath('userData')`, easy backup/export, nothing to
run/manage separately). No production data existed yet at migration time, so
there was no export/import step — just a schema rewrite.

- **Driver: `better-sqlite3`, not `node:sqlite` or `libSQL`.** Benchmarked
  faster than `node:sqlite` on local file ops (both are sync APIs, which
  suits SvelteKit's server-side request/response model); `libSQL`'s
  async/remote-first design costs 10–20x on local file ops, a bad trade for a
  purely local db. The deciding factor over `node:sqlite` specifically:
  **drizzle-kit does not support `node:sqlite` as a migration driver at
  all** ([drizzle-team/drizzle-orm#5471](https://github.com/drizzle-team/drizzle-orm/issues/5471))
  — you'd need `better-sqlite3` installed anyway just for `drizzle-kit
push`/`generate`/`migrate`, which defeats the "zero native deps" appeal
  that's the whole reason to reach for `node:sqlite`. Being a native module,
  `better-sqlite3` needs `@electron/rebuild` in the eventual Electron
  packaging pipeline — a real step, but the most well-documented native
  module in that ecosystem, not exploratory risk.
- **Id/timestamp/json column conventions**, all in
  [schema.ts](src/lib/server/db/schema.ts): SQLite has no native
  uuid/boolean/timestamp types, so `generateUUID()`/`createdAt()`/`updatedAt()`
  are small local helper functions (not exported — just factored out of the
  per-table repetition) wrapping `text().$defaultFn(() =>
crypto.randomUUID())` and `integer({ mode: 'timestamp_ms' })`. Timestamps
  are **app-generated (`$defaultFn(() => new Date())`), not DB-generated**
  (no `default(sql\`(unixepoch())\`)`) — deliberately millisecond precision,
because `messages.createdAt`is the sole ordering key for a session's
transcript ([contextManager.ts](src/lib/server/contextManager.ts),
[sessions.remote.ts](src/lib/sessions.remote.ts) both`orderBy:
  asc(createdAt)`with no secondary sort key) and a user message immediately
followed by an assistant reply can easily land in the same second.`updatedAt`has no`$onUpdate`— matching the original Postgres schema, it
only reflects insert time unless a tool explicitly sets it (see`saveMemoryTool.ts`/`updateTopicTool.ts`), so adding automatic bump-on-update
behavior here would have been a silent semantics change, not a faithful
port. `messageToolCalls.args`(Postgres`jsonb`) is `text({ mode: 'json'
  })` — SQLite has had real JSON query support (`json_extract`, `->`/`->>`)
since 3.38 (2022) and a binary JSONB storage optimization since 3.45
(2024), so this is not a capability loss for the debug-querying use case
that originally motivated `jsonb`, just a different storage encoding.
- **Dev reset**: [clean.ts](src/lib/server/db/clean.ts) deletes the sqlite
  file (plus `-wal`/`-shm` sidecars, since `journal_mode = WAL` is set in
  [db/index.ts](src/lib/server/db/index.ts)) rather than dropping/recreating
  a schema — the SQLite equivalent of the old `DROP SCHEMA public CASCADE`
  full-reset approach.
- Dropped entirely: `compose.dev.yaml`/`compose.prod.yaml` and the
  `POSTGRES_*` env vars — no server process to containerize anymore.
  `DATABASE_URL` is now a plain filesystem path (`.data/dev.sqlite3` /
  `.data/prod.sqlite3`, both gitignored).
- **`db.transaction()` callbacks must be plain, non-`async` functions with no
  `await` inside** — `better-sqlite3`'s underlying `.transaction()` wrapper
  runs the callback synchronously and throws `Transaction function cannot
return a promise` if the return value is thenable, which an `async`
  function's return value always is, regardless of what's inside it. This
  bit real code on the first migration pass: `postgres-js` transactions are
  async, so `saveAgent`/`deleteSession` in
  [agents.remote.ts](src/lib/agents.remote.ts) both used `async (tx) => {…}`
  callbacks with `await`ed queries — worked fine under Postgres, 500'd
  immediately under sqlite. Fix, confirmed by reading the installed
  `better-sqlite3`/`drizzle-orm` source and testing directly against a real
  db rather than guessing from docs: drop `async`, drop every `await` inside
  the callback, and call `.all()` (row-returning queries) or `.run()`
  (`delete`/plain `update`) explicitly on each query — the sync-mode query
  builder is a thenable that only executes once you either `await` it or
  call one of these terminal methods directly; without either, returning it
  bare also trips the same "thenable" check. `saveAgent`'s cycle-check
  originally called an `async` helper (`computeAncestorIds`, itself reading
  via the outer non-transactional `db`) — extracted the pure graph-BFS into
  a sync `ancestorsFromEdges(edges, agentId)` so it can run inline inside
  the sync transaction (`tx.select().from(agentSubagents).all()`) instead of
  needing an awaited call. These are currently the _only_ two
  `db.transaction()` call sites in the app — chat message persistence
  ([contextManager.ts](src/lib/server/contextManager.ts)) never used
  `db.transaction()` at all (plain sequential `await db.insert(...)` calls,
  no atomicity wrapper), so it was never affected by this and has a
  pre-existing, separate gap: a mid-write crash could leave a message
  persisted without its tool calls.

## How the agent works

- [src/lib/server/agent.ts](src/lib/server/agent.ts) — `Agent` class: the
  run loop that talks to a `ModelProvider`, executes tool calls, and persists
  turns via `ContextManager`. Max 20 iterations per `run(prompt, onChunk, signal)`.
- [src/lib/server/contextManager.ts](src/lib/server/contextManager.ts) —
  builds the message list sent to the model and persists messages/tool calls
  to SQLite (`messages`, `message_tool_calls` tables).
- [src/lib/server/modelProviders/](src/lib/server/modelProviders/) —
  `ModelProvider` interface; `OllamaProvider` is the current implementation.
- **Cancellation** is `AbortSignal`-based, threaded top-down as a plain
  parameter rather than stored as instance state anywhere.
  [sessions.remote.ts](src/lib/sessions.remote.ts)'s `runAgent` creates one
  `AbortController` per call and passes `.signal` into `Agent.run(...)`;
  `run()` checks `signal.aborted` at loop/tool-call checkpoints and, on an
  abort-triggered rejection from the model call or a tool, resolves
  _normally_ with `"Cancelled by user."` (persisted as the final assistant
  message) instead of throwing — the `runAgent` caller never sees an error.
  `Tool.execute(args, signal)` and `ModelProvider.chat`/`chatStream(...,
signal)` take the same signal directly; there is no `Tool.cancel()`
  method. An earlier design gave each tool its own `AbortController` plus a
  `cancel()` method that `Agent` forwarded to via a `currentTool` field —
  replaced after hitting a real race: [SubagentTool](src/lib/server/tools/subagentTool.ts)
  needed to hold a reference to a not-yet-constructed nested `Agent`
  (`Agent.create` does several DB round trips), and a cancel arriving in
  that window had nothing to forward to and was silently dropped. Passing
  one signal straight through instead closes that off by construction —
  `SubagentTool` now just hands the exact signal it receives into the
  nested `Agent.create(...)`/`run(...)` call, so cancellation reaches
  arbitrarily deep subagent chains for free (every level uses the identical
  mechanism recursively, not a bespoke forwarding chain), and there's never
  a window where the target of cancellation doesn't exist yet.
  [OllamaProvider](src/lib/server/modelProviders/ollamaProvider.ts) bridges
  the signal to `ollama`'s own imperative `abort()` via
  `signal.addEventListener('abort', ...)`, since the `ollama` package never
  accepts an external `AbortSignal` — it only ever attaches one internally,
  and only on the streaming code path, which is why `chat()` (non-streaming)
  delegates to `chatStream()` internally rather than issuing its own
  `stream: false` request. [sessionRegistry.ts](src/lib/server/sessionRegistry.ts)
  is a process-wide singleton mapping `sessionId` → `{ controller, text }`,
  letting a separate `cancelAgent` request (a different HTTP request than
  the one running `runAgent`) find and abort the right in-flight run; it
  also carries the streamed-reply-text/listener bookkeeping that used to be
  a separate `SessionStreamRegistry` — merged because both shared the exact
  same start/end lifecycle, and keeping them apart meant register/unregister
  order across two collaborators had to be reasoned about by hand (see git
  history for the bug that motivated this: unregistering the cancel handle
  before an `await` elsewhere in the same `finally` left a window where
  Cancel was clickable but silently did nothing). Not all tools are
  meaningfully cancellable: `save_memory`/`delete_memory`/`create_topic`/
  `update_topic`/`create_mistake`/`update_mistake` do a single fast SQLite
  write and ignore the signal entirely — `drizzle-orm` has no query
  cancellation support (an `AbortSignal`-param feature request has been open
  since Dec 2023 with no movement,
  [drizzle-team/drizzle-orm#1602](https://github.com/drizzle-team/drizzle-orm/issues/1602)) —
  while every Anki tool threads the signal straight into its
  `ankiRequest`/`ky` call and is genuinely abortable.
- [src/lib/server/tools/toolRegistry.ts](src/lib/server/tools/toolRegistry.ts) —
  maps tool names (as stored in the `tools` DB table / an agent's
  `agent_tools`) to `Tool` implementations. Some tools are contextual (need
  data from `ToolContext = { agentId, subjectId, urls }`), e.g. memory tools
  (`agentId` only), `create_topic`/`create_mistake` (`subjectId`, required
  — see "Subjects" below), and `fetch_url` (`urls`, see below).
  `registry`/`contextualRegistry` are both factory maps
  (`Record<string, () => Tool>` / `Record<string, (ctx: ToolContext) => Tool
| null>`), not eager singletons — `getTools`/`getSubagentTools` build
  fresh instances on every call, so every session gets private `Tool`
  objects instead of sharing one instance across every session in the
  process. This was originally required so per-tool `AbortController`s
  (from the earlier cancellation design above) couldn't leak across
  concurrent sessions; tools hold no per-call state at all anymore under
  the signal-based design, so it's no longer load-bearing for that specific
  reason, but it's harmless and left as-is rather than reverted back to
  singletons. A `contextualRegistry` factory returning `null` (only
  `fetch_url` does today) means `getTools()` omits that tool from the list
  entirely for this call — not "included with no valid arguments," genuinely
  absent, so the model never sees it as an option at all.
- **`fetch_url` tool** ([fetchUrlTool.ts](src/lib/server/tools/fetchUrlTool.ts)) —
  fetches a user-pasted URL and returns its main content as Markdown, via
  `@mozilla/readability` + `jsdom` (strip nav/ads/boilerplate down to the
  article) + `turndown` (HTML → Markdown). Deliberately local-only — `fetch`
  plus three small MIT/Apache-2.0 npm libs, no native deps, no hosted
  scraping API (Firecrawl etc.) — same reasoning as the Postgres→SQLite
  migration above: no external paid service or server process to depend on
  once this is a packaged Electron app. Only handles static/server-rendered
  pages (no JS execution) — covers Wikipedia and most blogs/news, not
  JS-hydrated or paywalled sites.
  - **The model can never type a URL itself.** `extractUserUrls()` regex-scans
    _only_ `role: 'user'` message text (never assistant output or tool
    results — no link-following) for `http(s)` URLs; the result becomes
    `ToolContext.urls`. `FetchUrlTool`'s constructor turns that list into
    single-letter labels (`A`, `B`, `C`…) and its `url` parameter is a
    closed `enum` of just those labels — the real URL only ever appears in
    the tool's _description_ text, never as something freeform the model
    can type. `execute()` resolves the chosen label back to the real URL and
    rejects anything else. This mirrors Anthropic's own `web_fetch` tool
    (confirmed via their docs): it also refuses a model-invented URL, only
    ones that literally already appeared in context — the point in both
    cases is closing off a prompt-injection exfiltration path (a malicious
    fetched page telling the model to "also fetch
    `https://attacker.com/log?data=…`"), not just convenience.
  - `ToolContext.urls` is computed fresh on every
    `Agent.createFromSession(sessionId, provider, prompt)` call
    ([agent.ts](src/lib/server/agent.ts)), scanning prior context
    (`contextManager.build()`, filtered to `role: 'user'`) _plus_ the
    incoming `prompt` string itself. `prompt` has to be threaded in as an
    explicit third argument (not read off `ctx` later) because
    `createFromSession` builds tools _before_ `run()` ever calls
    `ctx.add({ role: 'user', content: prompt })` — without passing it
    separately, a URL pasted in the very message that asks about it
    wouldn't be visible to that same turn's tool list yet.
    `Agent.create` (the subagent path, used only by
    [SubagentTool](src/lib/server/tools/subagentTool.ts)) always passes
    `urls: []` — a subagent's "prompt" is generated by its calling agent,
    not typed by a human, so it must never count toward this allowlist.
  - **Turndown strips `href`s and drops images entirely — measured, not
    just tidiness.** A real Wikipedia page (`Sapporo`) converted with links
    kept ran ~32,000 tokens against ~12,200 tokens of actual prose, almost
    entirely from ~730 markdown links (Wikipedia is extremely link-dense —
    nearly every proper noun is a wikilink) plus 49 embedded images. Since
    `NUM_CTX = 16384`
    ([ollamaProvider.ts](src/lib/server/modelProviders/ollamaProvider.ts)),
    one `fetch_url` call on an ordinary article could overflow the entire
    configured context budget on its own — and Ollama doesn't error on
    overflow, it silently drops the oldest turns (see the `NUM_CTX` comment
    in that file). Fix: `turndownService.addRule('stripLinkHrefs', ...)`
    keeps a link's visible text but drops the `href`; images use the same
    `addRule` pattern rather than the more obvious-looking
    `turndownService.remove('img')` — **`.remove()` doesn't actually win**
    for any tag Turndown already ships a built-in rule for. Confirmed by
    reading `turndown`'s source directly: its per-node rule lookup checks
    the main rule list (built-ins + everything added via `addRule`) _before_
    the separate list `.remove()` writes to, so a built-in `img` rule always
    matches first regardless. `addRule` works because it inserts at the
    front of that same main list, ahead of the built-in. Post-fix, the same
    page dropped to ~42,500 chars, close to the plain-text-only baseline.
  - **Not yet done:** no length cap, truncation, or summarization for very
    long articles — a long enough page could still overflow `NUM_CTX` even
    after link/image stripping. Flagged in-file (see the module's top-of-file
    `TODO`), not yet solved.
  - Required adding `enum?: string[]` to the tool-parameter schema type
    (now `JsonSchema`, see below — at the time this was `ToolParameter`),
    threaded through `toOllamaTool()` in `ollamaProvider.ts` — the `ollama`
    npm package's own `Tool` type already supported it, this was just never
    wired up before. Kept as a flat optional field alongside `type`/`items`
    rather than a separate discriminated variant: mirrors both JSON Schema
    itself (`enum` is a constraint keyword that composes with `type`, not a
    type of its own) and Anthropic/Google's actual tool-schema formats (both
    treat `enum` the same flat way per their docs), and matches the
    precedent `items` already set in this same type.
- **Tool parameter schemas are real JSON Schema, not a custom shape**
  ([src/lib/json.ts](src/lib/json.ts)) — `ToolDefinition.parameters`
  ([tool.ts](src/lib/server/tools/tool.ts)) is a `JsonObjectSchema`, matching
  what Anthropic's `input_schema`, OpenAI's `parameters`, and Ollama's own
  `Tool.function.parameters` all expect on the wire — confirmed directly
  against Anthropic's and OpenAI's docs: the root schema must be
  `type: object` (a tool call is always "invoke by name with named
  arguments," so there's no shape a lone parameter list could be other than
  an object), and `required` is a flat array of property names beside
  `properties`, never a per-property flag — it's only ever meaningful for
  object schemas, since only objects have named properties that can be
  present or absent. `JsonSchema` itself is a small recursive discriminated
  union (string/number/integer/boolean/array/object) covering exactly what
  tool-calling needs — unbounded nesting in both directions (array-of-arrays,
  object-of-objects) — not the full JSON Schema spec (no `$ref`, `oneOf`,
  etc.), since those aren't needed here and support for them is inconsistent
  across providers/local models anyway.
  This replaced an earlier `ToolParameter[]` design (flat array, `name` +
  `required: boolean` as sibling fields per entry) that wasn't actually
  JSON-Schema-shaped — every additional provider adapter would have had to
  redo the same recursive reshape work independently. With `JsonObjectSchema`
  as the canonical stored type, `toOllamaTool()` collapsed from two recursive
  conversion functions to a single cast (needed only because Ollama's own
  `.d.ts` types `items`/nested `properties` as `any` — far looser than what
  it actually accepts on the wire; the cast is the one seam between our
  precise type and a third-party type declaration that's coarser than its
  real behavior). A hypothetical `toAnthropicTool`/`toOpenAITool` would each
  be one line (`{ name, description, input_schema: tool.definition.parameters }`)
  — the expensive recursive-reshape work now happens once, not once per
  provider, whenever a second provider is actually added (still Ollama-only
  today).
  **Authoring ergonomics vs. wire format, kept deliberately separate:**
  writing `required: [...]` by hand as a second, parallel list (easy to typo
  or forget to update after a rename) wasn't acceptable, but neither was
  putting `optional`/`required` directly on `JsonSchema` itself — required-
  ness isn't a property of a _shape_, it's a property of the _relationship_
  between a name and its containing object (the same string schema can be
  required in one tool and optional in another). Resolved with a narrow,
  authoring-only layer: `JsonSchemaArgument = JsonSchema & { optional?: true }`
  plus `toJsonObjectSchema(properties: Record<string, JsonSchemaArgument>):
JsonObjectSchema`, which derives `required` from whichever properties
  _aren't_ marked `optional` — there's no separate array to keep in sync, and
  the real stored type (what every tool's `parameters` field actually is)
  never carries the authoring-only `optional` flag. Every existing tool
  definition was rewritten onto this.
- **`present_quiz` tool** ([presentQuizTool.ts](src/lib/server/tools/presentQuizTool.ts)) —
  agent-authored interactive quizzes, rendered inline in the chat transcript
  instead of as a generic tool-call JSON dump. Question shapes are a genuine
  discriminated union — `SingleChoiceQuestion`/`MultipleChoiceQuestion` in
  [src/lib/quiz.ts](src/lib/quiz.ts) (valibot `v.variant('questionType', [...])`)
  are fully independent shapes, not one shape sharing a polymorphic `answer`
  field, deliberately structured to accept more question types later (e.g.
  an `open_form` type with no `answer` field at all) without reworking
  existing ones — the discriminant enum the model actually sees stays
  exactly `['single_choice', 'multiple_choice']` until a new type is really
  built, per this project's "no half-finished implementations" rule; the
  extensibility is in the union's _shape_, not a pre-built unused branch.
  The model supplies the correct answer(s) directly in the tool call args
  (it already knows them) as an index/indices into `options` — always an
  array on the wire even for `single_choice` (simpler and more reliable for
  a local model to produce than a same-key field whose JSON type changes
  based on a sibling value), normalized down to a bare `number` by
  `singleChoiceQuestionSchema`'s own `v.transform`, so downstream code
  (grading, rendering) works with a real distinct shape per type instead of
  a length-1-array special case. Because the answer already lives in the
  persisted `messageToolCalls.args`, grading in
  [quiz.svelte](src/routes/chat/[sessionId]/quiz.svelte) is fully
  deterministic client-side — no extra model round-trip needed.
  The question-type discriminant is named `questionType`, not `type` —
  originally named `type`, which collided with JSON Schema's own `type`
  keyword one level down in that same property's own schema
  (`{ type: 'string', enum: [...] }`) and reliably confused a local model
  into omitting the field entirely: observed live, every question in a real
  quiz call arrived with `answer`/`options`/`question` but no `type` at all,
  despite the model correctly inferring single- vs multiple-choice from how
  many indices it put in `answer` — it understood the semantics but never
  wrote the key stating them.
  Rendering: [chat-message.svelte](src/routes/chat/[sessionId]/chat-message.svelte)
  special-cases `toolCall.name === 'present_quiz'` to render `<Quiz>` instead
  of the generic collapsed-JSON `<details>` block used for every other tool
  call — important beyond styling, since the generic block would otherwise
  print the answer key directly next to the quiz. `single-choice-question.svelte`/
  `multiple-choice-question.svelte` use shadcn-svelte's `RadioGroup`/`Checkbox`
  plus the `Field`/`FieldSet`/`FieldLegend` layout system (matching
  `agent-form.svelte`'s existing form conventions), not hand-rolled markup;
  `radio-group` was installed specifically for this — `field-set.svelte`'s
  own CSS already had `has-[>[data-slot=radio-group]]` rules hinting it was
  the intended pairing, before the component itself existed in the project.
  **Deliberately not built yet:** a `quiz_attempts` table, a dedicated
  `/quiz` history/retry route, and feeding results back into
  `create_mistake`/`update_topic` — scoped out explicitly to keep the first
  pass reviewable; the tool/schema/component split is structured so each
  slots in later without a rework.
- DB rows drive config: an `agents` row defines a system prompt and which
  tools it has (via `agent_tools`); a `sessions` row is one conversation
  with a chosen model; `memories` is per-agent persistent state; `study_topics`
  / `mistake_observations` are per-_subject_ (not per-agent — see "Subjects"
  below) persistent state the agent writes to itself via tools. `stories` is
  neither — it's subject-_independent_; see "Stories" below.
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
  model the calling agent is using. `getSubagentTools` requires
  `agents.subagentDescription` to be set on every directly assigned subagent —
  it throws immediately (no generic-description fallback) if one is missing,
  since an undescribed subagent tool is effectively uncallable by the model.
  This is checked eagerly for _all_ of an agent's direct subagents whenever
  that agent's session is created/resumed (`Agent.create`/`createFromSession`),
  not just the one actually invoked — so one misconfigured subagent breaks
  every session for every agent it's assigned to, not just calls to itself.
  Nested runs get a real `sessions` row like any other (via `Agent.create`),
  tagged with `sessions.parentSessionId` pointing back at the calling session
  (threaded through `getSubagentTools(agentId, callerModel, parentSessionId)` →
  `SubagentTool` → the nested `Agent.create` call) — fully persisted for
  debugging, just excluded from the top-level session lists
  (`getAllSessions`/`getAgentSessions` in
  [agents.remote.ts](src/lib/agents.remote.ts) both filter
  `isNull(sessions.parentSessionId)`). There's a real circular import between
  `agent.ts` → `toolRegistry.ts` → `subagentTool.ts` → `agent.ts` (the last
  edge importing `Agent` back); it's safe because `subagentTool.ts` only
  touches `Agent` inside `execute()`'s body, never at module top level, so
  nothing depends on the binding before all three modules finish loading —
  don't "fix" this cycle, it's not a bug.
- **Subjects**: `subjects` (name + description, see
  [src/lib/subjects.remote.ts](src/lib/subjects.remote.ts) and
  `src/routes/subjects/`) is the ownership/routing key for `study_topics` and
  `mistake_observations` — both have a `subjectId` FK (`NOT NULL`), not an
  `agentId` FK. `agents.subjectId` is a _nullable_ FK, many-to-one: several
  agent "personas" for the same language (e.g. a grammar-focused agent and an
  easier/beginner one) can share one subject and therefore one progress/
  mistake pool, instead of fragmenting it per agent. A subject-less agent is
  a "universal" agent (e.g. Anki) — not tied to one language. Topic/mistake
  tools are split into `create_*`/`update_*` pairs:
  `create_topic`/`create_mistake` require a subject to file the new row under,
  so `tools.isSubjectRequired` (a boolean column) gates their assignment both
  client-side ([agent-form.svelte](src/routes/agents/agent-form.svelte) hides
  them from the tool checklist when no subject is picked) and server-side
  (`saveAgent` in [agents.remote.ts](src/lib/agents.remote.ts) rejects the
  save). `update_topic`/`update_mistake` take a bare `id` (uuid) with no name
  lookup — there is currently no mechanism for the calling agent to obtain
  that id; this is a deliberate first pass, not a bug, pending further design.
  Assigning a subagent is also subject-gated: a subject-tied subagent can only
  go to a parent with the same subject or no subject (`getAssignableSubagents`,
  re-validated in `saveAgent`).
- **Stories** — a fourth persistent-block type alongside memories/topics/
  mistakes, but deliberately unlike them in shape: bigger, interactive
  content the user can revisit (a saved article, a roleplay transcript, a
  work session logged from an external tool), not a status field or a note
  log. See [schema.ts](src/lib/server/db/schema.ts) (`stories`,
  `story_content`, `files`, `story_resources`),
  [stories.remote.ts](src/lib/stories.remote.ts), and `src/routes/stories/`.
  - **`stories` itself has no `subjectId` — deliberately.** A story is the
    same content regardless of which subject/language it's being studied
    through (the seeded example: an NHK article saved natively in Japanese,
    also usable by a Mandarin agent — same story, different language). The
    only place a subject attaches is `story_content` (`storyId`, `subjectId`,
    `content`, `stale`, timestamps, `unique(storyId, subjectId)`) — one row
    per subject a story currently has content in. The row matching a story's
    originating subject isn't special-cased anywhere in the schema; it's
    just the first `story_content` row that happened to get written.
  - **Resources vs. content is a deliberate split**, not redundancy: a
    `story_resources` row (join: `storyId` + `fileId`, plus a `label`) points
    at the _original, unfiltered_ source material — kept in one language
    only, never translated, since a full translated webpage has essentially
    no use case. `story_content` holds a _concise, normal-sized_ distillation
    actually used for interaction — not shrunk to a few bullet points, just
    not the raw source — and is the thing that gets a variant per subject.
    Files themselves live on disk, not in SQLite (`files`: `path`,
    `mimeType`, `sizeBytes`) — same reasoning as the Postgres→SQLite move
    above, plus this table is intentionally generic (not story-specific) so
    a later RAG feature can reuse it without a parallel files table. This
    also ruled out a polymorphic `(resourceType, resourceId)` association
    (à la Rails ActiveStorage) in favor of the real, FK-checkable
    `story_resources` join — a polymorphic pair can't carry a real
    `.references()` constraint in SQLite, which every other relation in this
    schema relies on.
  - **`story_content.stale`** exists so a resource update can flag every
    language variant as needing a re-check, without inferring staleness by
    comparing a variant's `updatedAt` against `MAX(resource.updatedAt)`
    across a one-to-many `story_resources` relation — that comparison is
    exactly the kind of derived multi-row check that's easy to get subtly
    wrong (a resource touched for unrelated reasons would false-flag
    everything; timestamp granularity could false-negative). **Not yet
    wired up**: nothing currently sets `stale = true` anywhere, because
    nothing yet writes `story_resources` — that logic arrives together with
    whatever first writes resources (expected: the separate work-sessions
    MCP effort), not invented speculatively here.
  - **`save_story` tool** ([saveStoryTool.ts](src/lib/server/tools/saveStoryTool.ts))
    — a single tool taking a `mode: 'create' | 'update'` enum, rather than
    this project's usual `create_*`/`update_*` split (see `create_topic`/
    `update_topic` above). This is an explicit experiment, not yet proven
    better: the upside is less standing per-turn schema overhead (Ollama
    resends the full tool list every turn, so one tool beats two, compounded
    across a conversation); the downside is real — JSON Schema's `required`
    can express "always required," not "required only when `mode` is X," so
    that conditional requiredness has to be enforced at runtime instead of
    structurally, which is a weaker signal for a local model than the
    `create_topic`/`update_topic` split gets for free. Validation is pulled
    into a private `validateArgs()` that returns a mode-discriminated union
    (`{ mode: 'create'; title; content? } | { mode: 'update'; id; content }`),
    matching the `validateArgs` convention already used by
    [addNoteTool.ts](src/lib/server/tools/anki/addNoteTool.ts)/
    [addSentenceNoteTool.ts](src/lib/server/tools/anki/addSentenceNoteTool.ts)/
    [findQuery.ts](src/lib/server/tools/anki/findQuery.ts) — `execute()` just
    branches on the validated result instead of mixing validation into the
    DB-writing logic.
    - `mode: 'create'` — `title` required, `content` optional: a story can
      exist with zero content (e.g. before any resources are attached).
      Creating the story row itself needs no subject at all; a subject is
      only required at the moment content is actually given (content is
      always saved into the calling agent's own `ctx.subjectId`). This is
      why `save_story` is **not** `isSubjectRequired`-gated the way
      `create_topic`/`create_mistake` are — a subject-less agent can still
      create a (content-less) story.
    - `mode: 'update'` — `id` + `content` both required; upserts
      (`onConflictDoUpdate` on `unique(storyId, subjectId)`) the calling
      agent's own subject's `story_content` row — a genuine overwrite (e.g.
      a better-written version, a fresh translation), not an append like
      `update_topic`'s note log.
  - **`/files/[fileId]` server route** ([+server.ts](src/routes/files/[fileId]/+server.ts))
    — the first plain `+server.ts` endpoint in the app (everywhere else uses
    remote functions); needed because a resource's on-disk path can't be
    linked to directly from the browser. Reads the file, sets
    `Content-Disposition: inline` so a resource link opens in a new tab
    instead of downloading. `Content-Type` explicitly appends `; charset=
utf-8` for `text/*` mimetypes — without it, CJK resource text renders as
    mojibake, since a browser defaults `text/plain` with no charset to
    Latin-1, even though the file's on-disk bytes were correct UTF-8 all
    along (`writeFileSync`'s default encoding).
  - UI: `/stories` is a read-only `DataTable` list (same pattern as
    Topics/Mistakes — stories are populated by tools, not a manual form),
    showing every subject a story currently has content in (aggregated
    across `story_content`) rather than one fixed owner subject.
    `/stories/[storyId]` uses shadcn-svelte `Tabs` (first usage in the app)
    — one tab per subject's content variant, with a `Stale` badge when
    flagged; the initially-selected tab is a plain `$state(...)` initializer
    computed once from the already-resolved `story` data, not an `$effect`
    (see "UI / components" below — this was the case that prompted that
    rule). Resources render as real links to `/files/[fileId]`,
    `target="_blank"`.
  - Seed data ([seed.ts](src/lib/server/db/seed.ts) `STORY_SEEDS`)
    deliberately includes one cross-subject example (an NHK-style article
    with both Japanese and Mandarin `story_content` rows, plus a real `.txt`
    resource file written to `.data/files/` at seed time) specifically to
    exercise the subject-independence design, alongside two ordinary
    single-subject stories.

## MCP server

A second, independent tool-calling surface alongside the internal Ollama
loop above — an MCP (Model Context Protocol) stdio server that lets
_external_ clients (Claude Code, Claude Desktop) call into shinrin's own
tools, rather than shinrin calling out to a model. Entrypoint:
[scripts/mcp-server.ts](scripts/mcp-server.ts) (`pnpm mcp:server`); tool
registration: [saveStoryMcpTool.ts](src/lib/server/mcp/tools/saveStoryMcpTool.ts).
Only one tool exists so far, `save_story` — first use case was logging a
work/coding session as material for later roleplay practice (see "Stories"
above), but the tool itself is deliberately generic (any external tool can
hand off reusable content this way), not work-session-specific — it was
originally named `log_work_session` and renamed once that became clear.

- **stdio, not HTTP — deliberate, not a placeholder.** An MCP server can be
  a subprocess a client spawns and owns the pipes of (stdio), or a route a
  running server answers over HTTP. HTTP was seriously considered — it
  reuses the already-running app process/db connection, needs no per-client
  command/cwd registration, and normal stdout logging just works — but was
  rejected because it ties tool availability to shinrin's own web server
  being open, which defeats a real use case (logging a work session without
  wanting the study app open at the same time). The cost accepted instead:
  registration is per-client and slightly fiddly (see below), and there's
  no auth on the connection — acceptable since stdio's isolation is
  structural (the client owns the process; nothing else can reach it) and
  this is a personal, local, single-user tool. Because tool registration
  (`registerSaveStoryMcpTool(server, db)`) only touches a plain `McpServer`
  instance and knows nothing about the transport, switching to HTTP later
  (mounting `createMcpHandler`'s `fetch(request)` as a SvelteKit
  `+server.ts` route — already a web-standard `Request`→`Response`
  function, no framework adapter package needed) would only mean rewriting
  `scripts/mcp-server.ts`'s transport wiring, not the tool logic.
- **Package: `@modelcontextprotocol/server`, not `@modelcontextprotocol/sdk`.**
  The SDK recently split from one monolithic package into
  `@modelcontextprotocol/server` + `@modelcontextprotocol/client` — the
  `sdk` package name from older tutorials/blog posts is stale.
- **Tool schemas are valibot, via `@valibot/to-json-schema`, not zod.**
  `registerTool`'s `inputSchema` needs a `StandardSchemaWithJSON` — both a
  `~standard.validate` (which plain valibot already provides) _and_ a
  `~standard.jsonSchema` converter (which it doesn't). Confirmed directly
  against the installed package's own `.d.mts` files, not blog posts:
  `@valibot/to-json-schema`'s `toStandardJsonSchema()` bridges the gap, no
  migration off valibot needed anywhere else in the app.
- **The `subject` parameter is a dynamically-built enum, not a raw UUID
  field.** `registerSaveStoryMcpTool` queries `subjects` once at server
  startup and builds `v.picklist(subjectNames)`, resolving the chosen name
  back to a `subjectId` inside the handler — an external MCP client has no
  notion of shinrin's internal ids, and JSON Schema enums can't be
  recomputed per-call in this SDK's high-level `registerTool` API, only at
  registration time. Because this process is short-lived (a stdio server is
  spawned fresh per client session/reconnect, not long-running like the web
  app), a subject added mid-session simply not yet appearing is an accepted
  v1 gap, not a bug to fix — the next spawn picks it up.
- **A separate implementation from the internal `save_story` Tool
  ([saveStoryTool.ts](src/lib/server/tools/saveStoryTool.ts)), deliberately
  not shared or merged.** The internal tool's `subjectId` comes from
  `ToolContext` (the calling agent's own fixed subject); an MCP caller has
  no such identity and must pick a subject per call — different enough
  parameter shapes and typing conventions (valibot args here vs. this app's
  `JsonObjectSchema`/`JsonValue` convention there) that reusing/extending
  the internal tool wasn't a clean fit. Both tools happen to be named
  `save_story` — harmless, since they're different processes registered in
  entirely separate registries (Ollama's tool list vs. this MCP server's),
  but worth knowing if grepping for the name turns up two hits. `content`
  is always required here (unlike the internal tool's
  create-with-no-content-yet case), matching `story_content.content` being
  `NOT NULL` — this tool exists to hand off real content, not to create an
  empty placeholder story.
- **stdout is the JSON-RPC wire for a stdio server — nothing else may
  write to it, confirmed the hard way twice.** First, `pino`'s own default
  destination is stdout (see [logger.ts](src/lib/server/logger.ts)), so
  `mcp-server.ts` builds its own instance pointed at stderr
  (`pino.destination(2)`) instead of importing the shared `logger` export.
  Second, and less obvious: `dotenv`'s own `config()` call (inside
  [loadEnv()](src/lib/server/env.ts)) prints an "injected env" tip to
  **stdout** by default — this would have corrupted the protocol stream
  from a dependency neither logging setup accounted for. Only found by
  actually driving the server over raw stdio JSON-RPC (spawn it, send
  `initialize`/`tools/list`/`tools/call`, assert every stdout line parses
  as JSON) rather than trusting the design — fixed with `quiet: true` in
  `loadEnv()`, which also silences this same noise for
  `dev.ts`/`seed.ts`/`clean.ts` with no downside there.
- **Registration is per-MCP-client, not automatic, and desktop-app
  registration needed the raw config file, not the Connectors UI.** Claude
  Code: `claude mcp add shinrin -- pnpm --dir <path> mcp:server`. Claude
  Desktop's "Add custom connector" dialog turned out to be remote-URL-only
  (HTTPS + optional OAuth fields, no command/args) — local stdio servers
  there need a hand-edited `mcpServers` entry in
  `claude_desktop_config.json` instead, same `command`/`args` shape as the
  CLI. Either way the command must be cwd-independent (`pnpm --dir
<absolute-path> mcp:server`, not bare `pnpm mcp:server`) since a
  registered connector has no inherent project directory to run from.
  Restarting the app (or reconnecting the client) is required to pick up
  config changes — an already-open session does not retroactively gain a
  newly registered or renamed tool.
- **Defaults to dev mode, and that has a real trap worth knowing about.**
  `mcp-server.ts` calls `loadEnv(currentMode())`
  ([env.ts](src/lib/server/env.ts)), and with no `NODE_ENV` set (the
  default for a client-spawned process) that's `'development'` — the dev
  DB, the same one `DB_WIPE_ON_START` deletes and reseeds on every `pnpm
dev` start (see "Dev commands" below). For durable real use, the
  connector's config needs an explicit `"env": { "NODE_ENV": "production"
}`. Worse than just data loss on a wipe: because a stdio MCP client
  (Claude Desktop, at least) spawns the server once and keeps the same
  process alive across an entire session rather than respawning per call, a
  wipe that happens _while_ that process is already running leaves it
  holding an open file handle to the now-deleted, unlinked inode — Unix
  doesn't actually remove a file while a process still has it open, it just
  unlinks the directory entry. Every subsequent write from that process
  lands in this orphaned, invisible copy of the database — visible to
  nothing else, not the running web app, not a fresh
  `sqlite3`/`better-sqlite3` connection, forever, until that specific
  process exits. Confirmed by comparing `lsof`'s reported inode for the
  running `mcp-server.ts` process against `ls -i` on the current on-disk
  file — they didn't match. The fix in the moment was restarting the MCP
  client so it opens a fresh handle; the actual lesson is that any
  long-lived connection sharing the dev DB across a `DB_WIPE_ON_START`
  restart is fundamentally fragile, one more reason production use should
  point at the prod DB instead, where nothing ever wipes on start.
- **No lookup tool for an existing story's id** — same deliberate gap as
  `update_topic`/`update_mistake` (see "Subjects" above). `create`'s
  response text includes the new story's id specifically so a
  same-conversation `update` call has something to use; there's no way to
  recover it otherwise.

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
  The in-progress reply streams live via `getStreamingReply` (`query.live`,
  see "Remote functions" below) instead of waiting for the full response.
  Both screens also render a red square icon `Button` (`variant="destructive"
size="icon"`) while a run is active, calling `cancelAgent` (see
  Cancellation above for the server-side mechanism). Its `isLoading` state
  is driven by a local `stopping` flag — set the instant the button is
  clicked, cleared in `send()`/`startChat()`'s own `finally` once `runAgent`
  itself settles, _not_ by a `$effect` watching `isSending` (a `$effect`
  version was tried and reverted — using an effect to sync one piece of
  state off another, instead of reacting to something genuinely external,
  is exactly the pattern Svelte's own docs call out as the thing to avoid).
  This also isn't the same as watching `cancelAgent`'s own pending state,
  which resolves almost immediately — well before the underlying run has
  actually wound down — so `stopping` stays true for the whole cancellation
  span, paired with a "Stopping…" text line, since without it the button
  just looks inert for however long cancellation actually takes to land,
  which reads as broken rather than in-progress.
  `models.remote.ts` is superseded by
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
  in both files rather than a shared module. (A shared `svelte.compiler-options.js`
  was tried first; inlining instead didn't change the IDE false-positive below, so
  that wasn't the cause — kept duplicated anyway since it's simpler to reason about
  than a two-consumer shared file for two lines of config.)
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
  Same mechanism now covers sidebar navigation:
  [errorState.svelte.ts](src/lib/errorState.svelte.ts) exports a one-field class singleton
  (`errorState.active`); [error-empty-state.svelte](src/lib/components/error-empty-state.svelte)
  sets/clears it from `onMount`'s returned cleanup, not a bare `onDestroy` and not a
  top-level assignment — `errorState` is module-scope, so a write outside `onMount` would
  also run during SSR, where it's both the wrong order (`app-sidebar.svelte` renders above
  `{@render children()}`, i.e. before the error component further down the tree would even
  set it) and a real cross-request leak, since Node reuses the same module instance across
  concurrent requests. `onMount` never runs server-side at all, which keeps the flag
  strictly client-only in both directions, matching the fact that this bug itself only ever
  happens on client-side navigation. [app-sidebar.svelte](src/lib/components/app-sidebar.svelte)
  reads `errorState.active` to add `data-sveltekit-reload={errorState.active}` to its nav
  links — normal SPA links, except while an error page is currently showing, when they fall
  back to the same full-reload escape hatch as the recovery button above.
  Confirmed by reading the installed `@sveltejs/kit@3.0.0-next.8` source directly (it ships
  from `src/`, not a prebuilt `dist/`): `root.svelte`/`client.js` already call a private
  per-depth `resetters[depth]()` on every client-side navigation (citing
  sveltejs/kit#15694), trying to auto-clear failed boundaries — a _different_,
  already-fixed bug — but that doesn't reach into Svelte's `Boundary` internals to fix
  #16207 above, and `resetters` plus the render tree are module-private to kit's client
  runtime, never exported. There is no supported way to read "a boundary is currently
  failed" from app code (`page.error` doesn't cover this case either, see above) — that's
  why `errorState` exists as a hand-rolled signal instead of something read off an
  existing store.
- **IDE may falsely report `Cannot use \`await\` in deriveds... unless
  \`experimental.async\` is true`** (svelte.dev/e/experimental_async) even though the
  option is set and the real compiler (Vite dev server, `pnpm build`, `pnpm run
verify` — all confirmed clean) is fine with it. Not a config-location/staleness
  issue on our end — inlining `compilerOptions` directly (see above) didn't fix it
  either, so this looks like the editor's Svelte language server/extension not yet
  supporting kit3's config resolution at all, not something fixable from this repo.
  Ignore it (trust `pnpm run verify` over the editor's live diagnostics for this
  specific error) until the extension catches up; don't "fix" code that isn't broken
  chasing this one.

## UI / components

- **Avoid `$effect`, especially for syncing state.** It's an escape hatch, not
  a default tool. If you need to sync state to an external library (e.g.
  D3), prefer `{@attach ...}`. If you need to run code in response to a user
  interaction, put it directly in an event handler or a function binding. If
  you need to log values for debugging, use `$inspect`. If you need to
  observe something external to Svelte, use `createSubscriber`. A default
  value derived from async-loaded data (e.g. the initially-selected tab)
  should be a plain `$state(...)` initializer computed once from the
  resolved value, not an `$effect` that writes state — see
  [stories/[storyId]/+page.svelte](src/routes/stories/[storyId]/+page.svelte)
  for the pattern (`let activeSubjectId = $state(story.content[0]?.subjectId ?? '')`
  right after the awaited `$derived`, no effect needed).
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
- [Button](src/lib/components/ui/button/button.svelte) has an `isLoading` prop: when true it
  disables the button and swaps `children` for a `Spinner`, for both the `<button>` and `<a>`
  (`href`) render paths. Use it instead of hand-rolling a local
  `{#if pending}<Spinner />{:else}...{/if}` inside a `Button` — see
  [chat/+page.svelte](src/routes/chat/+page.svelte) or
  [agents/agent-form.svelte](src/routes/agents/agent-form.svelte) for the pattern. Doesn't apply
  to `AlertDialog.Action`/`.Cancel` ([alert-dialog-action.svelte](src/lib/components/ui/alert-dialog/alert-dialog-action.svelte),
  `-cancel.svelte`) — those are separate bits-ui-backed components styled with the same
  `buttonVariants` but not built on `Button` itself, so a pending dialog action still needs its
  own adjacent `Spinner` (see
  [delete-session-action.svelte](src/routes/chat/delete-session-action.svelte)).
- **A bits-ui `child`-snippet trigger (`AlertDialog.Trigger`, etc.) placed inside an element
  that already has its own `onclick` (e.g. a `DataTable` row via `onRowClick`) needs care** —
  two compounding gotchas, hit in
  [delete-session-action.svelte](src/routes/chat/delete-session-action.svelte):
  - The snippet's `props` bag must be spread onto your element for the trigger to actually
    open (it carries the real `onclick`, plus `aria-*`/`id`/ref wiring). But if you also
    write your own `onclick` _before_ `{...props}`, the spread's `onclick` silently wins and
    overwrites yours — attribute order matters, last one wins.
  - `props` is typed `Record<string, unknown>` (bits-ui's `WithChild` type is intentionally
    generic), so `props.onclick` is `unknown` — calling it yourself (e.g. to chain your own
    handler after `stopPropagation()`) doesn't type-check even with `?.()`.
  - Net effect: for a trigger nested in a row/element with its own click handler, skip
    `Trigger`/`child` entirely — drive the dialog with a local `let open = $state(false)` +
    `bind:open` on `.Root`, and a plain `Button` whose `onclick` calls
    `e.stopPropagation()` then sets `open = true`. This sidesteps both gotchas rather than
    fighting them, at the cost of losing the trigger's automatic `aria-*` wiring (worth
    adding by hand if that matters for the specific control).
  - This only applies when the trigger has a click-handling ancestor. A trigger with no such
    ancestor (e.g. [delete-agent-action.svelte](src/routes/agents/[agentId]/delete-agent-action.svelte),
    which sits in a plain form footer) has no conflict — keep using `Trigger`/`child` there,
    it's simpler and gives you the ARIA attributes for free.

## Dev commands (use pnpm)

- `pnpm dev` / `pnpm dev-debug` / `pnpm dev-trace` — runs [scripts/dev.ts](scripts/dev.ts).
  If `DB_WIPE_ON_START=true` (set in `.env.development`, default on) it first
  deletes the sqlite db file, then always does
  `drizzle-kit push --force` (schema sync straight from
  [schema.ts](src/lib/server/db/schema.ts), no migration files) + seeds the
  dev DB, then runs `vite dev`. Stopping it does nothing to the DB — the wipe
  only happens on the next start. Dev intentionally has no migration files at
  all — they were a source of friction when the data didn't matter anyway;
  see `db:prod:*` below for the real migration flow.
  The `-debug`/`-trace` variants set `LOG_LEVEL` for `pino` (default level is
  `info`, see [src/lib/server/logger.ts](src/lib/server/logger.ts)).
  No server process to start beforehand — the db is a local sqlite file.
- `pnpm build` then `pnpm start` — production build/run. `start` loads
  `.env.production` via Node's `--env-file` and does **not** seed or clean.
- `pnpm db:dev:push` / `db:dev:studio` / `db:dev:seed` / `db:dev:clean` — dev
  DB tools; `push` is also what `scripts/dev.ts` calls automatically.
- `pnpm db:prod:generate` / `db:prod:migrate` / `db:prod:studio` — real
  versioned migrations against prod (via
  [drizzle.config.prod.ts](drizzle.config.prod.ts)) — no prod push/seed/clean
  scripts exist on purpose, prod schema changes should go through reviewed
  migration files.
- `pnpm mcp:server` — runs [scripts/mcp-server.ts](scripts/mcp-server.ts), the
  MCP stdio server (see "MCP server" above). Not something you run directly
  day to day — an MCP client (Claude Code, Claude Desktop) spawns this
  command itself once registered. Defaults to dev mode/dev DB like
  everything else here unless the client config sets `NODE_ENV=production`.
- `pnpm check`, `pnpm lint`, `pnpm format`, `pnpm test` (vitest + playwright).

## Environment

- Per-mode env files following Vite's `.env.[mode]` convention:
  `.env.development` / `.env.production` (gitignored, real values) with
  `.env.development.example` / `.env.production.example` as committed
  templates. Each carries just `DATABASE_URL` — a filesystem path to a local
  sqlite file (`.data/dev.sqlite3` / `.data/prod.sqlite3`, both gitignored),
  so both can exist on the same machine side by side.
- [src/lib/server/env.ts](src/lib/server/env.ts) — `loadEnv(mode)` loads the
  right `.env.[mode]` file for anything that runs outside Vite (drizzle
  configs, seed, clean, `scripts/dev.ts`). SvelteKit's own dev/build/preview
  don't need it — Vite already loads `.env.[mode]` for the app's own env vars (see
  "SvelteKit 3" section above for how those are declared/imported now).
