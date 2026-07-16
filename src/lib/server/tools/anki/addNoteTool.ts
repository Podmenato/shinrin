import type { Tool, ToolDefinition } from '../tool';
import { ToolError } from '../tool';
import { ankiRequest } from './ankiClient';
import { GetDecksTool } from './getDecksTool';
import { GetModelsTool } from './getModelsTool';

export class AddNoteTool implements Tool {
	definition: ToolDefinition = {
		name: 'add_note',
		description:
			'Add a note to Anki. Use get_note_types to know which fields to fill.\n' +
			'\n' +
			'For Japanese vocab and Mandarin vocab notes, always populate both of these fields or Anki will not generate both cards:\n' +
			'  SentenceFurigana — front of the recognition card. The sentence as ruby HTML.\n' +
			'    Mandarin: <ruby>我<rt>wǒ</rt></ruby><ruby>负责<rt>fùzé</rt></ruby>这个项目。\n' +
			'    Japanese: <ruby>猫<rt>ねこ</rt></ruby>が<ruby>好<rt>す</rt></ruby>きです。\n' +
			'    Wrap each word or character in <ruby>...<rt>reading</rt></ruby>. Leave punctuation as plain text.\n' +
			'  SentenceMeaning — front of the production card. The English translation of the sentence.',
		parameters: [
			{ name: 'deckName', type: 'string', description: 'Target deck name', required: true },
			{
				name: 'modelName',
				type: 'string',
				description: 'Note type (model) name',
				required: true
			},
			{
				name: 'fields',
				type: 'object',
				description:
					'Field name to value pairs matching the note type. All values must be plain strings.',
				required: true
			},
			{
				name: 'tags',
				type: 'array',
				items: { type: 'string' },
				description:
					'Additional tags to apply to the note. The "shinrin" tag is always added automatically.',
				required: false
			}
		]
	};

	async execute(args: Record<string, unknown>): Promise<string> {
		await this.validateArgs(args);

		const tags = ['shinrin', ...((args.tags as string[] | undefined) ?? [])];

		const noteId = await ankiRequest<number>('addNote', {
			note: {
				deckName: args.deckName,
				modelName: args.modelName,
				fields: args.fields,
				tags,
				options: { allowDuplicate: false }
			}
		});

		return JSON.stringify({ noteId });
	}

	cancel(): Promise<string> {
		return Promise.resolve('ok');
	}

	async validateArgs(args: Record<string, unknown>) {
		const [decks, modelsRaw] = await Promise.all([
			new GetDecksTool().execute(),
			new GetModelsTool().execute()
		]);

		const deckList = JSON.parse(decks) as string[];
		const modelMap = JSON.parse(modelsRaw) as Record<string, string[]>;

		if (typeof args.deckName !== 'string' || args.deckName.trim() === '') {
			throw new ToolError('deckName must be a non-empty string.');
		}
		if (!deckList.includes(args.deckName)) {
			throw new ToolError(
				`Deck "${args.deckName}" doesn't exist. Available decks: ${deckList.join(', ')}.`
			);
		}

		if (typeof args.modelName !== 'string' || args.modelName.trim() === '') {
			throw new ToolError('modelName must be a non-empty string.');
		}
		if (!(args.modelName in modelMap)) {
			throw new ToolError(
				`Note type "${args.modelName}" doesn't exist. Available note types: ${Object.keys(modelMap).join(', ')}.`
			);
		}

		if (typeof args.fields !== 'object' || args.fields === null || Array.isArray(args.fields)) {
			throw new ToolError('fields must be an object.');
		}
		for (const [key, value] of Object.entries(args.fields as Record<string, unknown>)) {
			if (typeof value !== 'string') {
				throw new ToolError(
					`Field "${key}" must be a plain string, got ${typeof value === 'object' ? JSON.stringify(value) : typeof value}.`
				);
			}
		}
	}
}
