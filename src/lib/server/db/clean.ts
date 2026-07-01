// Drops and recreates the `public` schema — a full reset, not a per-table
// truncate, so it stays correct as the schema evolves without needing to
// enumerate tables here. Dev-only: called automatically by scripts/dev.ts
// when DB_WIPE_ON_START=true, or run manually via `pnpm db:dev:clean`.
// Never wired into any db:prod:* script.
import postgres from 'postgres';
import { currentMode, loadEnv } from '../env';

loadEnv(currentMode());

const client = postgres(process.env.DATABASE_URL!);

await client.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

console.log('Dropped and recreated the public schema.');
await client.end();
