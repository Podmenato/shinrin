import { query, command } from '$app/server';
import * as v from 'valibot';
import { logger } from '$lib/server/logger';
import { listModels, stopModel, type OllamaModel } from '$lib/server/ollamaAdmin';

export type { OllamaModel };

const POLL_INTERVAL_MS = 5_000;

/**
 * Streams downloaded Ollama models, annotated with running state, polling every 5s while a client is connected.
 * On first hydration yields null.
 */
export const getModels = query.live(async function* () {
	yield null;
	while (true) {
		try {
			yield await listModels();
		} catch (err) {
			logger.error({ err }, 'live model poll failed, keeping last known state');
		}
		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
	}
});

/** Stops the given running model. */
export const stopRunningModel = command(v.pipe(v.string(), v.nonEmpty()), async (model) => {
	await stopModel(model);
});
