import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { db } from './index';
import { providers } from './schema';

/**
 * Reads a provider's `config` JSON, validated against its own schema. A `null` config (never
 * configured yet) returns `defaults` untouched rather than parsing `null` against the schema.
 */
export async function getProviderConfig<T>(
	providerName: string,
	schema: v.GenericSchema<unknown, T>,
	defaults: T
): Promise<T> {
	const provider = await db.query.providers.findFirst({ where: { name: providerName } });
	if (!provider) {
		throw new Error(`Unknown provider: ${providerName}`);
	}
	if (provider.config == null) {
		return defaults;
	}
	return v.parse(schema, provider.config);
}

/** Overwrites a provider's `config` JSON wholesale — callers pass the full settings object. */
export async function saveProviderConfig<T>(providerName: string, config: T): Promise<void> {
	await db
		.update(providers)
		.set({ config, updatedAt: new Date() })
		.where(eq(providers.name, providerName));
}
