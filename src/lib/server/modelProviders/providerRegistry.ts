import * as v from 'valibot';
import type { ModelProvider } from './modelProvider';
import { OllamaProvider } from './ollamaProvider';
import { AnthropicProvider } from './anthropicProvider';
import { MistralProvider } from './mistralProvider';
import { logger } from '../logger';

/** Every registered provider name — the one hand-written source of truth. Everything else
 * (the type, the registry's required shape, valibot validation) is derived from or checked
 * against this array, not the other way around. */
export const PROVIDER_NAMES = ['ollama', 'anthropic', 'mistral'] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

// One instance per provider, not per model — a provider client is provider-level state (host,
// API key), and every call into it takes the model as a plain argument. Nothing to "create" per
// (provider, model) pair, so there's no factory function here, just a lookup table. Typing this
// as Record<ProviderName, ModelProvider> means TypeScript itself catches a forgotten or stray
// entry here the moment PROVIDER_NAMES changes — no separate check needed.
//
// Instantiated eagerly at module scope, so AnthropicProvider's constructor can't take an API key
// or config — both are read lazily per request instead (see anthropicApiKey()/getProviderConfig()
// calls inside anthropicProvider.ts), exactly like OllamaProvider already reads its num_ctx setting.
const registry: Record<ProviderName, ModelProvider> = {
	ollama: new OllamaProvider(),
	anthropic: new AnthropicProvider(),
	mistral: new MistralProvider()
};

/** Valibot schema for a `ModelSelection` — the one shape used at every command/form boundary
 * that needs a provider+model pair, instead of each call site re-deriving its own. */
export const modelSelectionSchema = v.object({
	provider: v.picklist(PROVIDER_NAMES),
	name: v.pipe(v.string(), v.nonEmpty())
});

/** Looks up the provider instance for a registered provider name. Throws on an unknown provider. */
export function getModelProvider(provider: ProviderName): ModelProvider {
	const instance = registry[provider];
	if (!instance) {
		throw new Error(`Unknown provider: ${provider}`);
	}
	return instance;
}

/** One provider's currently selectable models, for `listAllModelOptions`. */
export type ProviderModels = { provider: ProviderName; models: string[] };

/**
 * Every provider's currently selectable models, grouped by provider (the shape a picker actually
 * renders — provider headings over their models) — listed live from each provider's own listing,
 * never from the `models` table (that table only records what has actually been used, see
 * getOrCreateModel). One provider being unreachable must not blank the others.
 */
export async function listAllModelOptions(): Promise<ProviderModels[]> {
	const groups: ProviderModels[] = [];

	for (const provider of PROVIDER_NAMES) {
		try {
			groups.push({ provider, models: await registry[provider].listModels() });
		} catch (err) {
			logger.warn({ err, provider }, 'failed to list models for provider');
		}
	}

	return groups;
}
