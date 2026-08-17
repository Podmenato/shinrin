import type { Tool, ToolDefinition } from '../tool';
import { ankiRequest } from './ankiClient';
import { toJsonObjectSchema, type JsonValue } from '#lib/json.js';

export class GetModelsTool implements Tool {
	definition: ToolDefinition = {
		name: 'get_note_types',
		description: 'Returns all Anki note types (models) and their fields',
		parameters: toJsonObjectSchema({})
	};

	async execute(_args: Record<string, JsonValue>, signal: AbortSignal): Promise<string> {
		const modelNames = await ankiRequest<string[]>('modelNames', {}, signal);
		const modelWithFieldNames = await Promise.all(
			modelNames.map(async (modelName) => {
				const fieldNames = await ankiRequest<string[]>('modelFieldNames', { modelName }, signal);
				return [modelName, fieldNames] as [string, string[]];
			})
		);
		return JSON.stringify(Object.fromEntries(modelWithFieldNames));
	}
}
