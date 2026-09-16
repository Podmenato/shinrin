import { db } from './index';
import { models } from './schema';

/**
 * Resolves a (provider name, model name) pair to a `models.id`, creating the row the first time
 * this exact pair is seen. `providers` is a small, migration-seeded catalog (see
 * providerCatalog.ts) — this only ever creates `models` rows, never `providers` rows, and throws
 * if the provider name isn't already a real row (callers validate it against PROVIDER_NAMES
 * before reaching here, so this should never actually happen).
 */
export async function getOrCreateModel(providerName: string, modelName: string): Promise<string> {
	const provider = await db.query.providers.findFirst({ where: { name: providerName } });
	if (!provider) {
		throw new Error(`Unknown provider: ${providerName}`);
	}

	await db
		.insert(models)
		.values({ providerId: provider.id, name: modelName })
		.onConflictDoNothing();

	const model = await db.query.models.findFirst({
		where: { providerId: provider.id, name: modelName }
	});
	if (!model) {
		throw new Error(`Failed to get or create model "${modelName}" for provider "${providerName}"`);
	}
	return model.id;
}
