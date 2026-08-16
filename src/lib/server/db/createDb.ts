import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

// No SvelteKit/Vite dependency here on purpose — this is called with an arbitrary path (a real
// file from db/index.ts, ':memory:' when VITEST is set, or a path built by hand from seed.ts/
// clean.ts/scripts/mcp-server.ts, none of which run through Vite) so it stays plain Node.
export function createDb(path: string) {
	mkdirSync(dirname(path), { recursive: true });
	const client = new Database(path);
	// No-op on ':memory:' (SQLite has no WAL for in-memory databases) rather than an error.
	client.pragma('journal_mode = WAL');
	return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
