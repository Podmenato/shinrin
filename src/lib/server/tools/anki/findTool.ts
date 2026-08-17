import type { Tool, ToolDefinition } from '../tool';
import { ankiRequest } from './ankiClient';
import { FIND_DESCRIPTION, FIND_PROPERTIES, buildFindQuery, validateFindArgs } from './findQuery';
import { toJsonObjectSchema, type JsonValue } from '#lib/json.js';

export class FindTool implements Tool {
	definition: ToolDefinition = {
		name: 'find',
		description:
			'Search Anki cards or notes by structured filters. Returns matching IDs.\n' +
			'  type:card (default) — returns card IDs. Use when you need card-level data like ease or intervals.\n' +
			'  type:note — returns note IDs. Use when you need note-level data or to check for duplicates.\n' +
			'\n' +
			FIND_DESCRIPTION,
		parameters: toJsonObjectSchema({
			type: {
				type: 'string',
				description: 'What to search: "card" (default) or "note".',
				optional: true
			},
			...FIND_PROPERTIES
		})
	};

	async execute(args: Record<string, JsonValue>, signal: AbortSignal): Promise<string> {
		const type = args.type === 'note' ? 'note' : 'card';
		const action = type === 'note' ? 'findNotes' : 'findCards';

		const ids = await ankiRequest<number[]>(
			action,
			{ query: buildFindQuery(await validateFindArgs(args, signal)) },
			signal
		);
		return JSON.stringify(ids);
	}
}
