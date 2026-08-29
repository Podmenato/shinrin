// Production start: migrates and rebuilds only when package.json's version
// differs from what's actually deployed (tracked in .data/VERSION, next to
// the prod db — see dbPath() in src/lib/server/env.ts). An unchanged
// version means the last `pnpm start` already migrated and built, so this
// just launches the already-built server.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { dbPath, loadEnv } from '#lib/server/env.js';

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
	run('vite', ['build']);
	writeFileSync(versionFile, version);
}

// scripts/server.ts, not adapter-node's generated build/index.js — see that
// file for why. Reads SHINRIN_PORT itself; nothing to pass in here.
run('tsx', ['scripts/server.ts']);
