# shinrin

Shinrin (森林, "forest") is a personal language-study LLM assistant. It works best as a supplement to Anki.

## Features

- Create and chat with a language-tutor agent that has persistent per-agent memory and
  direct tool access to your Anki collection (search, add notes, and more)
  via AnkiConnect.
- Subagents — an agent can delegate to another agent as a tool call (e.g. a
  general tutor delegating Anki-specific work to a dedicated Anki agent).
- Article reading — paste an URL and the agent fetches and reads it
  (`fetch_url` tool) for vocab/grammar help grounded in real text.
- Agents can generate quizzes (`present_quiz` tool), rendered and graded inline in the
  chat.
- Stories — a collection of content the agent can read and write,
  independent of which language you're studying it in.
- An MCP server exposing a `save_story` tool, so external MCP clients
  (Claude Code, Claude Desktop) can hand content into shinrin directly.

## Setup

Prerequisites:

- [Docker](https://www.docker.com/products/docker-desktop/)
- [Ollama](https://ollama.com/download) (`http://localhost:11434`, with at least one model pulled)

Not strictly necessary, but there isn't really a point in not running them together

- [Anki](https://apps.ankiweb.net/#downloads)
- [AnkiConnect](https://ankiweb.net/shared/info/2055492159)

Only needed for development (see below), not for just running it:

- [Node 26](https://nodejs.org/en/download)
- [pnpm](https://pnpm.io/installation)

## Running it

```sh
docker compose up --build
```

This builds the image and starts the container. Every start applies any
pending database migrations first, so pulling a newer version and running
this again picks up new migrations automatically.

Ollama and AnkiConnect are expected to be running natively on your
machine, not inside the container — the container reaches them via
`host.docker.internal`, already configured in
[docker-compose.yml](docker-compose.yml).

By default this listens on `0.0.0.0:4287` — reachable from any device on
your local network, not just this machine, and with no login of any kind.
That's a deliberate trade-off for a personal, single-user tool, but worth
knowing before running it on a network you don't trust. Change
`SHINRIN_PORT` in [docker-compose.yml](docker-compose.yml) to use a
different port.

## Developing

First setup the `.env.development` file

```sh
cp .env.development.example .env.development
```

Then run with

```sh
pnpm dev
```

`pnpm dev-debug` and `pnpm dev-trace` are the same command with more verbose
logging.

Every start syncs the database schema to match
[schema.ts](src/lib/server/db/schema.ts). If `DB_WIPE_ON_START=true` in
`.env.development` (the default), it also wipes the database and reseeds it
with example data first, so every session starts from a known state. Set
`DB_WIPE_ON_START=false` to keep your data across restarts instead.

## Changing the schema

Whenever you change [schema.ts](src/lib/server/db/schema.ts), generate a
migration for it and commit the result together with the schema change:

```sh
pnpm run migrate
```

This writes a new file under [drizzle/](drizzle), the app's migration
history. `pnpm start` applies whatever's pending here to the production
database.

## Releasing a version

```sh
pnpm version patch   # or minor / major
git push --follow-tags
```

This bumps the version in `package.json`, commits it, and tags the commit
(`vX.Y.Z`). Anyone updating an existing instance picks up the new code and
migrations with `git pull && docker compose up --build`.

## Commands

| Command                                | Does                                                                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm start`                           | Build and run the app.                                                                                                                                            |
| `pnpm dev` / `dev-debug` / `dev-trace` | Run the app in development.                                                                                                                                       |
| `pnpm build`                           | Build the app without starting it.                                                                                                                                |
| `pnpm run migrate`                     | Generate a database migration from `schema.ts`.                                                                                                                   |
| `pnpm check`                           | Type-check the project.                                                                                                                                           |
| `pnpm lint`                            | Check formatting and lint rules.                                                                                                                                  |
| `pnpm format`                          | Auto-format the codebase.                                                                                                                                         |
| `pnpm test`                            | Run the test suite.                                                                                                                                               |
| `pnpm verify`                          | `check` + `lint` + `test` — the full "is this okay" gate.                                                                                                         |
| `pnpm mcp` / `mcp-dev`                 | Start the MCP server, in production or development mode. Launched by an MCP client (Claude Code, Claude Desktop) once registered — not something you run by hand. |

### Inspecting or resetting the database directly

```sh
pnpm exec drizzle-kit push --force                            # sync the dev db to schema.ts
pnpm exec drizzle-kit studio                                  # browse the dev db
pnpm exec tsx src/lib/server/db/seed.ts                        # reseed the dev db
pnpm exec tsx src/lib/server/db/clean.ts                       # delete the dev db file
```
