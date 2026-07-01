import { config } from 'dotenv';

// Node doesn't read .env files by itself — only real OS/shell env vars are in
// process.env automatically. Anything that runs outside Vite (drizzle-kit
// configs, seed/clean scripts, scripts/dev.ts) needs to load its own
// .env.[mode] file explicitly. SvelteKit's own dev/build/preview don't need
// this — Vite already loads .env.[mode] for $env/dynamic/private.

export type Mode = 'development' | 'production';

export function loadEnv(mode: Mode): void {
	config({ path: `.env.${mode}`, override: true });
}

// Only meaningful for scripts that might run in either environment (seed,
// clean) — NODE_ENV must already be set by whoever invoked the process, it
// can't come from the file we're about to load (chicken-and-egg).
export function currentMode(): Mode {
	return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}
