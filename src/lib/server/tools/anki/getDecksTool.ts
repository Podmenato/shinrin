import type { Tool, ToolDefinition } from '../tool';
import { ankiRequest } from './ankiClient';

export class GetDecksTool implements Tool {
	definition: ToolDefinition = {
		name: 'get_decks',
		description: 'Returns a list of all Anki deck names',
		parameters: []
	};

	private controller: AbortController | null = null;

	async execute(): Promise<string> {
		this.controller = new AbortController();

		try {
			const decks = await ankiRequest<string[]>('deckNames', {}, this.controller.signal);
			return JSON.stringify(decks);
		} finally {
			this.controller = null;
		}
	}

	cancel(): Promise<string> {
		this.controller?.abort();
		return Promise.resolve('Cancelled by user.');
	}
}
