import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDb } from './createDb';
import { currentMode, dbPath } from '../env';

export * from './createDb';

// A real temp file, not ':memory:' — vitestSetup.ts pushes the schema by shelling out to the
// `drizzle-kit push` CLI (a separate process), which can't reach into another process's in-memory
// db. Computed once per test file's module evaluation, so each file gets its own isolated db even
// when vitest runs files in parallel.
export const testDbPath = process.env.VITEST
	? join(tmpdir(), `shinrin-test-${crypto.randomUUID()}.sqlite3`)
	: undefined;

export const db = createDb(testDbPath ?? dbPath(currentMode()));
