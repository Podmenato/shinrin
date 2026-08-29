// Deletes the sqlite db file (plus its WAL/SHM sidecar files) — a full
// reset, not a per-table truncate, so it stays correct as the schema
// evolves without needing to enumerate tables here. Dev-only: called
// automatically by scripts/dev.ts when DB_WIPE_ON_START=true, or run
// manually via `pnpm exec tsx src/lib/server/db/clean.ts`. Never used for
// the persistent prod db — scripts/start.ts only ever runs a migration
// against it, never a wipe.
import { rmSync } from 'node:fs';
import { currentMode, dbPath } from '../env';

const path = dbPath(currentMode());
for (const p of [path, `${path}-wal`, `${path}-shm`]) {
	rmSync(p, { force: true });
}

console.log('Deleted the sqlite database file.');
