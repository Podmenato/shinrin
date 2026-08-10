import type { Tool, ToolDefinition } from '../tool';
import { ankiRequest } from './ankiClient';

export class GetModelsTool implements Tool {
	definition: ToolDefinition = {
		name: 'get_note_types',
		description: 'Returns all Anki note types (models) and their fields',
		parameters: []
	};

	private controller: AbortController | null = null;

	async execute(): Promise<string> {
		this.controller = new AbortController();
		const { signal } = this.controller;

		try {
			const modelNames = await ankiRequest<string[]>('modelNames', {}, signal);
			const modelWithFieldNames = await Promise.all(
				modelNames.map(async (modelName) => {
					const fieldNames = await ankiRequest<string[]>('modelFieldNames', { modelName }, signal);
					return [modelName, fieldNames] as [string, string[]];
				})
			);
			return JSON.stringify(Object.fromEntries(modelWithFieldNames));
		} finally {
			this.controller = null;
		}
	}

	cancel(): Promise<string> {
		this.controller?.abort();
		return Promise.resolve('Cancelled by user.');
	}
}
