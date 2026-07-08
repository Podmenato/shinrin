import { query, command } from '$app/server';
import * as v from 'valibot';
import { listModels, stopModel } from '$lib/server/ollamaAdmin';

/** Returns all downloaded Ollama models, annotated with running state. */
export const getModels = query(async () => listModels());

/** Stops the given running model. */
export const stopRunningModel = command(v.pipe(v.string(), v.nonEmpty()), async (model) => {
	await stopModel(model);
});
