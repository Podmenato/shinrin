// Deletes the sqlite db file (plus its WAL/SHM sidecar files) — a full
// reset, not a per-table truncate, so it stays correct as the schema
// evolves without needing to enumerate tables here. Dev-only: called
// automatically by scripts/dev.ts when DB_WIPE_ON_START=true, or run
// manually via `pnpm db:dev:clean`. Never wired into any db:prod:* script.
import { rmSync } from 'node:fs';
import { currentMode, loadEnv } from '../env';

loadEnv(currentMode());

const dbPath = process.env.DATABASE_URL!;
for (const path of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
	rmSync(path, { force: true });
}

console.log('Deleted the sqlite database file.');
