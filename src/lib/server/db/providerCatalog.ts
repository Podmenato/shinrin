// The fixed set of registered model providers, one row per key in providerRegistry.ts's
// `registry`. Single source of truth for seed.ts's dev insert — production gets this row from a
// committed data migration instead (drizzle/*_backfill_models), since prod never runs seed.ts.
// When adding a provider here, also add a new migration for it (`pnpm exec drizzle-kit generate
// --custom --config drizzle.config.prod.ts`, then hand-write the INSERT) — this array alone never
// reaches production. Mirrors toolCatalog.ts's TOOL_CATALOG exactly.
export const PROVIDER_CATALOG: { name: string }[] = [{ name: 'ollama' }];
