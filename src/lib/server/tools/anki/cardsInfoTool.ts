import type { Tool, ToolDefinition } from '../tool';
import { ankiRequest } from './ankiClient';
import type { KanjiFields, VocabFields } from './noteTypes';

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
			'Returns scheduling data (ease factor, interval, lapses, reps, due) and content for a list of card IDs. Use after find_cards to analyze card performance.',
		parameters: [
			{
				name: 'cardIds',
				type: 'array',
				items: { type: 'integer' },
				description: 'Array of card IDs to fetch',
				required: true
			}
		]
	};

	async execute(args: Record<string, unknown>): Promise<string> {
		const cards = await ankiRequest<CardInfo[]>('cardsInfo', { cards: args.cardIds });

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

	cancel(): Promise<string> {
		return Promise.resolve('ok');
	}
}
