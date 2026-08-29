// Production start: migrates and rebuilds only when package.json's version
// differs from what's actually deployed (tracked in .data/VERSION, next to
// the prod db — see dbPath() in src/lib/server/env.ts). An unchanged
// version means the last `pnpm start` already migrated and built, so this
// just launches the already-built server.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { dbPath, loadEnv, shinrinPort } from '#lib/server/env.js';

loadEnv('production');

// `drizzle-kit migrate` opens the sqlite file directly (not through
// createDb.ts, which normally makes this guarantee) — on a fresh clone
// `.data/` may not exist yet.
mkdirSync(dirname(dbPath('production')), { recursive: true });

function run(command: string, args: string[]): void {
	const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
	if (result.status !== 0) {
		console.error(`\n"${[command, ...args].join(' ')}" failed.\n`);
		process.exit(result.status ?? 1);
	}
}

const { version } = JSON.parse(readFileSync('package.json', 'utf-8'));
const versionFile = '.data/VERSION';
const deployedVersion = existsSync(versionFile) ? readFileSync(versionFile, 'utf-8').trim() : null;

if (deployedVersion !== version) {
	// A version bump can add/change dependencies (e.g. after `git pull`) —
	// install first so `drizzle-kit`/`vite` below run against current deps,
	// not whatever was installed for the previous version.
	run('pnpm', ['install']);
	run('drizzle-kit', ['migrate', '--config', 'drizzle.config.prod.ts']);
	// Bakes SHINRIN_ORIGIN (vite.config.ts's `paths.origin`) into the built
	// server — see the shinrinOrigin() comment in env.ts. Since this whole
	// block only runs on a version change, editing .env.production's
	// SHINRIN_ORIGIN alone won't take effect until the next version bump.
	// To pick it up sooner, delete .data/VERSION (not `pnpm build` by itself
	// — that skips loadEnv('production') above, so .env.production wouldn't
	// even be read) so this block runs again on the next `pnpm start`.
	run('vite', ['build']);
	writeFileSync(versionFile, version);
}

// Unlike ORIGIN, adapter-node reads PORT fresh from the environment on every
// launch — no rebuild needed for it to take effect. HOST is left alone —
// adapter-node's own default is already 0.0.0.0.
process.env.PORT = shinrinPort();

run('node', ['build']);
