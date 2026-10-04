import { config } from 'dotenv';

// Node doesn't read .env files by itself — only real OS/shell env vars are in
// process.env automatically. Anything that runs outside Vite (drizzle-kit
// configs, seed/clean scripts, scripts/dev.ts) needs to load its own
// .env.[mode] file explicitly. SvelteKit's own dev/build/preview don't need
// this — Vite already loads .env.[mode] for $env/dynamic/private.

export type Mode = 'development' | 'production';

export function loadEnv(mode: Mode): void {
	config({ path: `.env.${mode}`, override: true, quiet: true });
}

// Only meaningful for scripts that might run in either environment (seed,
// clean) — NODE_ENV must already be set by whoever invoked the process, it
// can't come from the file we're about to load (chicken-and-egg).
export function currentMode(): Mode {
	return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

// The db is just a file in a folder, not a real connection string — dev and
// prod never run from the same folder, so a literal per-mode path here loses
// nothing an env var would have bought (this used to be DATABASE_URL, a
// leftover from when the db was Postgres and the "connection string" part
// was actually the configurable bit).
export function dbPath(mode: Mode): string {
	return mode === 'production' ? '.data/prod.sqlite3' : '.data/dev.sqlite3';
}

export function shinrinPort(): string {
	return process.env.SHINRIN_PORT ?? '4287';
}

export function ollamaBaseUrl(): string {
	return process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
}

export function ankiConnectUrl(): string {
	return process.env.ANKI_CONNECT_URL ?? 'http://localhost:8765';
}

// Deliberately never stored in `providers.config` or anywhere else in the database — this app has
// no auth and binds 0.0.0.0, so a credential sitting in a LAN-readable settings page would be
// dangerous. `undefined` (unset) is a normal state, not an error: AnthropicProvider.listModels
// treats it as "Anthropic simply isn't configured" rather than throwing.
export function anthropicApiKey(): string | undefined {
	return process.env.ANTHROPIC_API_KEY;
}
