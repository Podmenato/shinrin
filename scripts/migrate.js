import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { dbPath, currentMode } from '#lib/server/env.ts';

const client = new DatabaseSync(dbPath(currentMode()));
const db = drizzle({ client });

migrate(db, { migrationsFolder: './drizzle' });
