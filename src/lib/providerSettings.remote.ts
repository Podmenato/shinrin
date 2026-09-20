import { query, form } from '$app/server';
import { getProviderConfig, saveProviderConfig } from '#lib/server/db/providerSettings.js';
import {
	ollamaSettingsSchema,
	DEFAULT_OLLAMA_SETTINGS
} from '#lib/server/modelProviders/ollamaProvider.js';

export const getOllamaSettings = query(async () => {
	return getProviderConfig('ollama', ollamaSettingsSchema, DEFAULT_OLLAMA_SETTINGS);
});

export const saveOllamaSettings = form(ollamaSettingsSchema, async (settings) => {
	await saveProviderConfig('ollama', settings);
	await getOllamaSettings().refresh();
});
