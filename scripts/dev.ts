// Wraps `vite dev` so the dev DB is always in a known state before the app
// starts: optionally wipe-and-seed, then always schema-push. Nothing runs
// when the dev server stops — the wipe (if enabled) happens on the *next*
// start, not on Ctrl+C. The dev db is a local sqlite file (see dbPath() in
// src/lib/server/env.ts) — no server process to start beforehand.
import { spawn, spawnSync } from 'node:child_process';
import { loadEnv } from '#lib/server/env.js';

loadEnv('development');

function run(command: string, args: string[]): void {
	const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
	if (result.status !== 0) {
		console.error(`\n"${[command, ...args].join(' ')}" failed.\n`);
		process.exit(result.status ?? 1);
	}
}

// Set in .env.development. When true, every `pnpm dev` starts from an empty,
// freshly-seeded schema. Flip to false locally if you want data to survive
// across restarts — seed.ts only runs right after a wipe: most of its
// inserts have no conflict handling, so re-running it against data that's
// still there would duplicate rows instead of being a no-op.
if (process.env.DB_WIPE_ON_START === 'true') {
	run('tsx', ['src/lib/server/db/clean.ts']);
}

// `push` (not `migrate`) on purpose, and unconditional: dev has no tracked
// migration files at all — generating/reviewing them was pure friction when
// the data behind them was going to be wiped anyway. Running it even without
// a wipe is what lets schema.ts edits reach a kept-around dev db across
// restarts. `--force` auto-approves destructive diffs non-interactively;
// since the schema is either empty or was just wiped above, there's nothing
// destructive to approve in the wiped case — a kept-around db taking a real
// destructive diff (e.g. a dropped column) is the one case this could still
// silently lose data in, which is acceptable for throwaway dev data.
run('drizzle-kit', ['push', '--force']);
if (process.env.DB_WIPE_ON_START === 'true') {
	run('tsx', ['src/lib/server/db/seed.ts']);
}

const vite = spawn('vite', ['dev', ...process.argv.slice(2)], {
	stdio: 'inherit',
	env: process.env
});

vite.on('exit', (code) => process.exit(code ?? 0));
