import { defineConfig } from 'drizzle-kit';
import { dbPath } from '#lib/server/env.js';

// Prod counterpart of drizzle.config.ts — used via `--config
// drizzle.config.prod.ts` by `pnpm run migrate` (generate), which diffs the
// schema against the committed migration history and touches no database.
// Migrations are applied by scripts/migrate.js at container start. The real
// prod db lives in the Docker volume, not at `dbCredentials.url` on the host,
// so commands that open a db (`studio`, `migrate`) don't point at it from
// here. Deliberately has no `push` script pointed at it: prod schema changes
// go through committed migration files, not a direct schema sync.
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: { url: dbPath('production') },
	verbose: true,
	strict: true
});
