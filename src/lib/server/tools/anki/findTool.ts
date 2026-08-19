import type { Tool, ToolDefinition } from '../tool';
import { ankiRequest } from './ankiClient';
import { FIND_DESCRIPTION, FIND_PROPERTIES, buildFindQuery, validateFindArgs } from './findQuery';
import { toJsonObjectSchema, type JsonValue } from '#lib/json.js';

export class FindTool implements Tool {
	definition: ToolDefinition = {
		name: 'find',
		description:
			'Search Anki cards or notes by structured filters. Returns matching IDs.\n' +
			'  type:card (default) — returns card IDs. If you need note content/fields for these cards, use cards_info — NEVER get_note_info.\n' +
			'  type:note — returns note IDs. If you need note content/fields, use get_note_info.\n' +
			'  Card IDs and note IDs are different numbers, never interchangeable — passing a card ID to get_note_info silently returns the wrong note, not an error.\n' +
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
