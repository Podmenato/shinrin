import type { Tool, ToolDefinition } from '../tool';
import { ankiRequest } from './ankiClient';
import type { KanjiFields, VocabFields } from './noteTypes';
import { toJsonObjectSchema, type JsonValue } from '#lib/json.js';

const KANJI_MODEL = 'Japanese Kanji';
const JAPANESE_VOCAB_MODEL = 'Japanese vocab';
const MANDARIN_VOCAB_MODEL = 'Mandarin vocab';

type CardInfo = {
	cardId: number;
	note: number;
	deckName: string;
	modelName: string;
	fields: KanjiFields | VocabFields;
	tags: string[];
	interval: number;
	factor: number;
	lapses: number;
	reps: number;
	type: number;
	due: number;
	nextReviews: [string, string, string, string];
};

function buildCard(card: CardInfo, fields: KanjiFields | VocabFields): CardInfo {
	return {
		cardId: card.cardId,
		note: card.note,
		deckName: card.deckName,
		modelName: card.modelName,
		fields,
		tags: card.tags,
		interval: card.interval,
		factor: card.factor,
		lapses: card.lapses,
		reps: card.reps,
		type: card.type,
		due: card.due,
		nextReviews: card.nextReviews
	};
}

export class CardsInfoTool implements Tool {
	definition: ToolDefinition = {
		name: 'cards_info',
		description:
			'Returns scheduling data (ease factor, interval, lapses, reps, due) and full note content (fields) for a list of card IDs. Use after find (type:card, the default). This already includes everything get_note_info would return, so there is no need to also call get_note_info on these IDs (and doing so is wrong: card IDs are not note IDs). The "note" field in each result is the underlying note ID, included for reference only.',
		parameters: toJsonObjectSchema({
			cardIds: {
				type: 'array',
				items: { type: 'integer' },
				description: 'Array of card IDs to fetch'
			}
		})
	};

	async execute(args: Record<string, JsonValue>, signal: AbortSignal): Promise<string> {
		const cards = await ankiRequest<CardInfo[]>('cardsInfo', { cards: args.cardIds }, signal);

		const cleanedCards = cards.map((card) => {
			if (card.modelName === KANJI_MODEL) {
				const cardFields = card.fields as KanjiFields;
				const cleanedCardFields: KanjiFields = {
					Kanji: cardFields.Kanji,
					Words: cardFields.Words,
					Onyomi: cardFields.Onyomi,
					Kunyomi: cardFields.Kunyomi
				};
				return buildCard(card, cleanedCardFields);
			} else if (
				card.modelName === JAPANESE_VOCAB_MODEL ||
				card.modelName === MANDARIN_VOCAB_MODEL
			) {
				const cardFields = card.fields as VocabFields;
				const cleanedCardFields: VocabFields = {
					Expression: cardFields.Expression,
					Reading: cardFields.Reading,
					Sentence: cardFields.Sentence,
					Nuance: cardFields.Nuance
				};
				return buildCard(card, cleanedCardFields);
			} else {
				return buildCard(card, card.fields);
			}
		});

		return JSON.stringify(cleanedCards);
	}
}
