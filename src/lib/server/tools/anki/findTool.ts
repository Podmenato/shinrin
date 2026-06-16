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

	async execute(args: Record<string, unknown>): Promise<string> {
		const type = args.type === 'note' ? 'note' : 'card';
		const action = type === 'note' ? 'findNotes' : 'findCards';

		const ids = await ankiRequest<number[]>(action, {
			query: buildFindQuery(await validateFindArgs(args))
		});
		return JSON.stringify(ids);
	}

	cancel(): Promise<string> {
		return Promise.resolve('ok');
	}
}
