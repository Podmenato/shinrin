import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { DATABASE_URL } from '$app/env/private';

mkdirSync(dirname(DATABASE_URL), { recursive: true });
const client = new Database(DATABASE_URL);
client.pragma('journal_mode = WAL');

export const db = drizzle(client, { schema });
