import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { afterAll } from 'vitest';
import { testDbPath } from './index';

// pushSQLiteSchema (the old programmatic push API, `drizzle-kit/api`) doesn't exist for SQLite in
// drizzle-kit v1 — confirmed against the installed package: `drizzle-kit/api-sqlite` only exports
// `startStudioServer`, unlike `drizzle-kit/api-postgres`, which still has push-related exports. So
// this shells out to the same `drizzle-kit push` CLI dev already uses (`db:dev:push`), pointed at
// this test file's own temp sqlite file (`testDbPath`, see db/index.ts) via drizzle.config.test.ts
// instead of the shared dev db. `stdio: 'pipe'` keeps the CLI's own progress output out of test
// runs on the happy path; on failure the captured output is surfaced so it's still debuggable.
try {
	execFileSync(
		'node_modules/.bin/drizzle-kit',
		['push', '--force', '--config', 'drizzle.config.test.ts'],
		{ env: { ...process.env, TEST_DB_PATH: testDbPath }, stdio: 'pipe' }
	);
} catch (e) {
	const err = e as { stdout?: Buffer; stderr?: Buffer };
	console.error(err.stdout?.toString(), err.stderr?.toString());
	throw e;
}

afterAll(() => {
	for (const suffix of ['', '-wal', '-shm']) {
		rmSync(`${testDbPath}${suffix}`, { force: true });
	}
});
