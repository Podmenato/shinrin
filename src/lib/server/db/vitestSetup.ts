import { pushSQLiteSchema } from 'drizzle-kit/api';
import { db } from './index';
import * as schema from './schema';

// db/index.ts already points `db` at a fresh ':memory:' instance whenever VITEST is set (vitest
// sets it automatically) — this just has to fill that instance with the schema once before each
// test file's tests run. drizzle-kit/api types this against LibSQLDatabase, but it only needs
// the shared sqlite session interface, which the better-sqlite3-backed `db` also satisfies.
const { statementsToExecute } = await pushSQLiteSchema(
	schema,
	db as unknown as Parameters<typeof pushSQLiteSchema>[1]
);

// Deliberately not calling the returned `apply()` — it runs each statement through drizzle's
// `.all()`, which better-sqlite3 throws on for any statement with no result set (every DDL
// statement here: `CREATE TABLE`, etc.) with "This statement does not return data. Use run()
// instead." libsql (what this API is actually built/typed around) tolerates that; better-sqlite3
// doesn't. `$client.exec()` runs raw SQL without expecting a result set, which is exactly what
// schema DDL is, so it sidesteps the bug instead of fighting it.
for (const statement of statementsToExecute) {
	db.$client.exec(statement);
}
