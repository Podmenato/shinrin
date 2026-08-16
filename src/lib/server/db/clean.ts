// Deletes the sqlite db file (plus its WAL/SHM sidecar files) — a full
// reset, not a per-table truncate, so it stays correct as the schema
// evolves without needing to enumerate tables here. Dev-only: called
// automatically by scripts/dev.ts when DB_WIPE_ON_START=true, or run
// manually via `pnpm db:dev:clean`. Never wired into any db:prod:* script.
import { rmSync } from 'node:fs';
import { currentMode, dbPath } from '../env';

const path = dbPath(currentMode());
for (const p of [path, `${path}-wal`, `${path}-shm`]) {
	rmSync(p, { force: true });
}

console.log('Deleted the sqlite database file.');
