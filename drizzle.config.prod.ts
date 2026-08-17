import { defineConfig } from 'drizzle-kit';
import { dbPath } from '#lib/server/env.js';

// Prod counterpart of drizzle.config.ts — used via `--config
// drizzle.config.prod.ts` for db:prod:generate/migrate/studio. Deliberately
// has no `push` script pointed at it: prod schema changes should go through
// reviewed migration files, not a direct schema sync.
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: { url: dbPath('production') },
	verbose: true,
	strict: true
});
