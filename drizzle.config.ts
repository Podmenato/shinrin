import { defineConfig } from 'drizzle-kit';
import { loadEnv } from '$lib/server/env';

// This is the dev config (drizzle-kit only supports --config for pointing
// at an alternate file, not env files, hence a second drizzle.config.prod.ts
// instead of branching on NODE_ENV in this one).
loadEnv('development');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: { url: process.env.DATABASE_URL },
	verbose: true,
	strict: true
});
