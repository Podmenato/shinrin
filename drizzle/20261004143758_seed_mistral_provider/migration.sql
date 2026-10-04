-- Custom SQL migration file, put your code below! --
-- Prod counterpart of PROVIDER_CATALOG in providerCatalog.ts gaining a `mistral` entry — prod
-- never runs seed.ts. Same shape as seed_anthropic_provider.
INSERT INTO `providers` (`id`, `name`, `createdAt`, `updated_at`) VALUES
	('8471dded-7802-4dc2-a031-7cf46684e4ed', 'mistral', (unixepoch() * 1000), (unixepoch() * 1000))
ON CONFLICT (`name`) DO NOTHING;
