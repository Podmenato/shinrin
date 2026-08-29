import { defineConfig } from 'drizzle-kit';
import { dbPath } from '#lib/server/env.js';

// Prod counterpart of drizzle.config.ts — used via `--config
// drizzle.config.prod.ts` by `pnpm run migrate` (generate) and
// scripts/start.ts (migrate), plus ad-hoc `drizzle-kit studio`. Deliberately
// has no `push` script pointed at it: prod schema changes go through
// committed migration files, not a direct schema sync.
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: { url: dbPath('production') },
	verbose: true,
	strict: true
});
