import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { dbPath, currentMode } from '#lib/server/env.ts';

// Foreign keys off for the whole connection, not via the migration files' own
// `PRAGMA foreign_keys=OFF`: drizzle's migrator runs every pending migration inside one
// BEGIN…COMMIT, and SQLite ignores that pragma inside a transaction. With them on (node:sqlite's
// default), a table rebuild's `DROP TABLE` fires ON DELETE CASCADE on every child table — e.g.
// rebuilding `sessions` deletes every message.
const client = new DatabaseSync(dbPath(currentMode()), { enableForeignKeyConstraints: false });
const db = drizzle({ client });

migrate(db, { migrationsFolder: './drizzle' });

// With enforcement off, nothing stopped a migration from leaving dangling references. This runs
// after the commit, so it can't undo anything — it fails the container start instead of letting
// the app run on a broken database.
const violations = client.prepare('PRAGMA foreign_key_check').all();
if (violations.length > 0) {
	console.error('Foreign key violations after migrating:', violations);
	process.exit(1);
}
