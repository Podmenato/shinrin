import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { relations } from './schema';

// No SvelteKit/Vite dependency here on purpose — this is called with an arbitrary path (a real
// file from db/index.ts — a per-test-file temp file when VITEST is set, see testDbPath — or a
// path built by hand from seed.ts/clean.ts/scripts/mcp-server.ts, none of which run through Vite)
// so it stays plain Node.
export function createDb(path: string) {
	mkdirSync(dirname(path), { recursive: true });
	const client = new DatabaseSync(path);
	client.exec('PRAGMA journal_mode = WAL');
	return drizzle({ client, relations });
}

export type Db = ReturnType<typeof createDb>;
