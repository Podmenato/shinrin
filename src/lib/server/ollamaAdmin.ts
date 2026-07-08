import { Ollama, type ModelResponse } from 'ollama';
import { logger } from './logger';

const OLLAMA_LOCAL_URL = 'http://localhost:11434';
const ollama = new Ollama({ host: OLLAMA_LOCAL_URL });

export interface OllamaModel extends ModelResponse {
	running: boolean;
}

/** Returns all downloaded models, each annotated with whether it's currently running. */
export async function listModels(): Promise<OllamaModel[]> {
	let downloaded: ModelResponse[];
	let running: ModelResponse[];
	try {
		[downloaded, running] = await Promise.all([
			ollama.list().then((r) => r.models),
			ollama.ps().then((r) => r.models)
		]);
	} catch (err) {
		logger.error({ err }, 'failed to list ollama models');
		throw new Error('Failed to list models', { cause: err });
	}

	return downloaded.map((model) => {
		const runningModel = running.find((r) => r.model === model.model);
		return runningModel ? { ...runningModel, running: true } : { ...model, running: false };
	});
}

/** Stops (unloads) a running model by forcing keep_alive to 0. */
export async function stopModel(model: string): Promise<void> {
	try {
		// seems like a hack, but this is what ollama stop apparently
		// does too https://github.com/ollama/ollama/blob/main/cmd/cmd.go
		await ollama.generate({ model, prompt: '', keep_alive: 0 });
		logger.info({ model }, 'stopped ollama model');
	} catch (err) {
		logger.error({ err, model }, 'failed to stop ollama model');
		throw new Error(`Failed to stop model ${model}`, { cause: err });
	}
}
