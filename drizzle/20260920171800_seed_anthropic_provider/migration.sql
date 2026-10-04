-- Custom SQL migration file, put your code below! --
-- Prod counterpart of PROVIDER_CATALOG in providerCatalog.ts gaining an `anthropic` entry — prod
-- never runs seed.ts, so the new provider row has to land here instead. Same shape as the
-- `providers` insert in 20260915175139_backfill_and_tighten_models/migration.sql. No `models` rows
-- to backfill alongside it (unlike that migration) — no session/quick-ask/agent has ever run on
-- Anthropic, there's no historical model-name data pointing at it.
INSERT INTO `providers` (`id`, `name`, `createdAt`, `updated_at`) VALUES
	('576f6294-f84a-435d-93c9-7a285f1a1d76', 'anthropic', (unixepoch() * 1000), (unixepoch() * 1000))
ON CONFLICT (`name`) DO NOTHING;
