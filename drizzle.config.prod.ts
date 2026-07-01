import { defineConfig } from 'drizzle-kit';
import { loadEnv } from '$lib/server/env';

// Prod counterpart of drizzle.config.ts — used via `--config
// drizzle.config.prod.ts` for db:prod:generate/migrate/studio. Deliberately
// has no `push` script pointed at it: prod schema changes should go through
// reviewed migration files, not a direct schema sync.
loadEnv('production');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.DATABASE_URL },
	verbose: true,
	strict: true
});
