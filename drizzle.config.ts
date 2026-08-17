import { defineConfig } from 'drizzle-kit';
import { dbPath } from '#lib/server/env.js';

// This is the dev config (drizzle-kit only supports --config for pointing
// at an alternate file, not env files, hence a second drizzle.config.prod.ts
// instead of branching on NODE_ENV in this one).
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: { url: dbPath('development') },
	verbose: true,
	strict: true
});
