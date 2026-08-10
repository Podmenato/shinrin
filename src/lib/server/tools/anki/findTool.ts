import type { Tool, ToolDefinition } from '../tool';
import { ankiRequest } from './ankiClient';
import { FIND_DESCRIPTION, FIND_PARAMETERS, buildFindQuery, validateFindArgs } from './findQuery';

export class FindTool implements Tool {
	definition: ToolDefinition = {
		name: 'find',
		description:
			'Search Anki cards or notes by structured filters. Returns matching IDs.\n' +
			'  type:card (default) — returns card IDs. Use when you need card-level data like ease or intervals.\n' +
			'  type:note — returns note IDs. Use when you need note-level data or to check for duplicates.\n' +
			'\n' +
			FIND_DESCRIPTION,
		parameters: [
			{
				name: 'type',
				type: 'string',
				description: 'What to search: "card" (default) or "note".',
				required: false
			},
			...FIND_PARAMETERS
		]
	};

	private controller: AbortController | null = null;

	async execute(args: Record<string, unknown>): Promise<string> {
		this.controller = new AbortController();

		const type = args.type === 'note' ? 'note' : 'card';
		const action = type === 'note' ? 'findNotes' : 'findCards';

		try {
			const ids = await ankiRequest<number[]>(
				action,
				{ query: buildFindQuery(await validateFindArgs(args)) },
				this.controller.signal
			);
			return JSON.stringify(ids);
		} finally {
			this.controller = null;
		}
	}

	cancel(): Promise<string> {
		this.controller?.abort();
		return Promise.resolve('Cancelled by user.');
	}
}
