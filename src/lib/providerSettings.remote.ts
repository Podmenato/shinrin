import { query, form } from '$app/server';
import { getProviderConfig, saveProviderConfig } from '#lib/server/db/providerSettings.js';
import {
	ollamaSettingsSchema,
	DEFAULT_OLLAMA_SETTINGS
} from '#lib/server/modelProviders/ollamaProvider.js';
import {
	anthropicSettingsSchema,
	DEFAULT_ANTHROPIC_SETTINGS
} from '#lib/server/modelProviders/anthropicProvider.js';
import {
	mistralSettingsSchema,
	DEFAULT_MISTRAL_SETTINGS
} from '#lib/server/modelProviders/mistralProvider.js';

export const getOllamaSettings = query(async () => {
	return getProviderConfig('ollama', ollamaSettingsSchema, DEFAULT_OLLAMA_SETTINGS);
});

export const saveOllamaSettings = form(ollamaSettingsSchema, async (settings) => {
	await saveProviderConfig('ollama', settings);
	await getOllamaSettings().refresh();
});

export const getAnthropicSettings = query(async () => {
	return getProviderConfig('anthropic', anthropicSettingsSchema, DEFAULT_ANTHROPIC_SETTINGS);
});

export const saveAnthropicSettings = form(anthropicSettingsSchema, async (settings) => {
	await saveProviderConfig('anthropic', settings);
	await getAnthropicSettings().refresh();
});

export const getMistralSettings = query(async () => {
	return getProviderConfig('mistral', mistralSettingsSchema, DEFAULT_MISTRAL_SETTINGS);
});

export const saveMistralSettings = form(mistralSettingsSchema, async (settings) => {
	await saveProviderConfig('mistral', settings);
	await getMistralSettings().refresh();
});
