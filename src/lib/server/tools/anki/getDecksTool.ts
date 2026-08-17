import type { Tool, ToolDefinition } from '../tool';
import { ankiRequest } from './ankiClient';
import { toJsonObjectSchema, type JsonValue } from '#lib/json.js';

export class GetDecksTool implements Tool {
	definition: ToolDefinition = {
		name: 'get_decks',
		description: 'Returns a list of all Anki deck names',
		parameters: toJsonObjectSchema({})
	};

	async execute(_args: Record<string, JsonValue>, signal: AbortSignal): Promise<string> {
		const decks = await ankiRequest<string[]>('deckNames', {}, signal);
		return JSON.stringify(decks);
	}
}
