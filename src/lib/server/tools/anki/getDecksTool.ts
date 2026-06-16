import type { Tool, ToolDefinition } from '../tool';
import { ankiRequest } from './ankiClient';

export class GetDecksTool implements Tool {
	definition: ToolDefinition = {
		name: 'get_decks',
		description: 'Returns a list of all Anki deck names',
		parameters: []
	};

	async execute(): Promise<string> {
		const decks = await ankiRequest<string[]>('deckNames');
		return JSON.stringify(decks);
	}

	cancel(): Promise<string> {
		return Promise.resolve('ok');
	}
}
