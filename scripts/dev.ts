// Wraps `vite dev` so the dev DB is always in a known state before the app
// starts: optionally wipe, then schema-push, then seed. Nothing runs when
// the dev server stops — the wipe (if enabled) happens on the *next* start,
// not on Ctrl+C. Requires the dev DB container to already be running
// (`pnpm db:dev:start`, started manually — docker lifecycle is never
// automatic here).
import { spawn, spawnSync } from 'node:child_process';
import { loadEnv } from '$lib/server/env';

loadEnv('development');

function run(command: string, args: string[]): void {
	const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
	if (result.status !== 0) {
		console.error(
			`\n"${[command, ...args].join(' ')}" failed. Is the dev database running? Try: pnpm db:dev:start\n`
		);
		process.exit(result.status ?? 1);
	}
}

// Set in .env.development. When true, every `pnpm dev` starts from an empty
// schema — no stale dev data to reason about between sessions. Flip to
// false locally if you want data to survive across restarts.
if (process.env.DB_WIPE_ON_START === 'true') {
	run('tsx', ['src/lib/server/db/clean.ts']);
}

// `push` (not `migrate`) on purpose: dev has no tracked migration files at
// all — generating/reviewing them was pure friction when the data behind
// them was going to be wiped anyway. `--force` auto-approves destructive
// diffs non-interactively; since the schema is either empty or was just
// wiped above, there's nothing destructive to approve in practice.
run('drizzle-kit', ['push', '--force']);
run('tsx', ['src/lib/server/db/seed.ts']);

const vite = spawn('vite', ['dev', ...process.argv.slice(2)], {
	stdio: 'inherit',
	env: process.env
});

vite.on('exit', (code) => process.exit(code ?? 0));
