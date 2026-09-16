import type { ProviderName } from '#lib/server/modelProviders/providerRegistry.js';

export type ModelSelection = { provider: ProviderName; name: string };

/**
 * bits-ui `Select` values must be strings, so a selection is encoded for transport through the
 * component and decoded immediately on change. Split on the FIRST colon only: provider names
 * never contain one, Ollama model names routinely do (`qwen3:8b`).
 */
export function encodeModelSelection(selection: ModelSelection): string {
	return `${selection.provider}:${selection.name}`;
}

export function decodeModelSelection(value: string): ModelSelection {
	const colonIndex = value.indexOf(':');
	return {
		provider: value.slice(0, colonIndex) as ProviderName,
		name: value.slice(colonIndex + 1)
	};
}
