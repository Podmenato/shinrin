import { defineConfig } from 'drizzle-kit';

// Test counterpart of drizzle.config.ts — used by vitestSetup.ts to `push` the schema into each
// test file's own temp sqlite file (see db/index.ts's `testDbPath`). Unlike dev/prod, the target
// path isn't known ahead of time (it's generated fresh per test file), so it comes from an env
// var the calling process sets rather than a literal path.
if (!process.env.TEST_DB_PATH) {
	throw new Error('drizzle.config.test.ts requires TEST_DB_PATH to be set.');
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: { url: process.env.TEST_DB_PATH }
});
