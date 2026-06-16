import type { Tool, ToolDefinition } from '../tool';
import { ToolError } from '../tool';
import { ankiRequest } from './ankiClient';
import { GetDecksTool } from './getDecksTool';

const MODEL_NAME = 'Agent sentence';

export class AddSentenceNoteTool implements Tool {
	definition: ToolDefinition = {
		name: 'add_sentence_note',
		description:
			'Add a sentence note using the Agent sentence note type. ' +
			'Automatically creates Reading, Production and Listening cards and routes each to the correct deck.\n' +
			'\n' +
			'Pass decks in card template order: [Reading deck, Production deck, Listening deck].\n' +
			'Example: ["Mandarin sentences (Reading)", "Mandarin sentences (Production)", "Mandarin sentences (Listening)"]',
		parameters: [
			{
				name: 'decks',
				type: 'array',
				items: { type: 'string' },
				description: 'Deck names in card order: [Reading, Production, Listening].',
				required: true
			},
			{
				name: 'sentence',
				type: 'string',
				description: 'The sentence in the target language.',
				required: true
			},
			{
				name: 'translation',
				type: 'string',
				description: 'English translation of the sentence.',
				required: true
			},
			{
				name: 'reading',
				type: 'string',
				description: 'Furigana or pinyin reading of the sentence. Optional but recommended.',
				required: false
			},
			{
				name: 'notes',
				type: 'string',
				description: 'Extra context, nuance, or grammar explanation. Optional.',
				required: false
			},
			{
				name: 'tags',
				type: 'array',
				items: { type: 'string' },
				description: 'Additional tags. "shinrin" is always added automatically.',
				required: false
			}
		]
	};

	async execute(args: Record<string, unknown>): Promise<string> {
		const { decks, sentence, translation, reading, notes, tags } = await this.validateArgs(args);
		const [readingDeck, productionDeck, listeningDeck] = decks;

		const noteId = await ankiRequest<number>('addNote', {
			note: {
				deckName: readingDeck,
				modelName: MODEL_NAME,
				fields: { Sentence: sentence, Translation: translation, Reading: reading, Notes: notes },
				tags: ['shinrin', ...tags],
				options: { allowDuplicate: false }
			}
		});

		const [{ cards }] = await ankiRequest<{ cards: number[] }[]>('notesInfo', { notes: [noteId] });
		const [readingCard, productionCard, listeningCard] = cards;

		await Promise.all([
			ankiRequest('changeDeck', { cards: [productionCard], deck: productionDeck }),
			ankiRequest('changeDeck', { cards: [listeningCard], deck: listeningDeck })
		]);

		return JSON.stringify({
			noteId,
			cards: {
				reading: { deck: readingDeck, cardId: readingCard },
				production: { deck: productionDeck, cardId: productionCard },
				listening: { deck: listeningDeck, cardId: listeningCard }
			}
		});
	}

	cancel(): Promise<string> {
		return Promise.resolve('ok');
	}

	async validateArgs(args: Record<string, unknown>) {
		const deckList = JSON.parse(await new GetDecksTool().execute()) as string[];

		if (!Array.isArray(args.decks) || args.decks.length !== 3) {
			throw new ToolError(
				'decks must be an array of exactly 3 deck names: [Reading, Production, Listening].'
			);
		}
		for (const deck of args.decks as string[]) {
			if (!deckList.includes(deck)) {
				throw new ToolError(
					`Deck "${deck}" doesn't exist. Available decks: ${deckList.join(', ')}.`
				);
			}
		}

		if (typeof args.sentence !== 'string' || args.sentence.trim() === '') {
			throw new ToolError('sentence must be a non-empty string.');
		}
		if (typeof args.translation !== 'string' || args.translation.trim() === '') {
			throw new ToolError('translation must be a non-empty string.');
		}
		if (args.reading !== undefined && typeof args.reading !== 'string') {
			throw new ToolError('reading must be a string.');
		}
		if (args.notes !== undefined && typeof args.notes !== 'string') {
			throw new ToolError('notes must be a string.');
		}
		if (args.tags !== undefined && !Array.isArray(args.tags)) {
			throw new ToolError('tags must be an array of strings.');
		}

		return {
			decks: args.decks as string[],
			sentence: args.sentence,
			translation: args.translation,
			reading: args.reading as string | undefined,
			notes: args.notes as string | undefined,
			tags: (args.tags as string[] | undefined) ?? []
		};
	}
}
