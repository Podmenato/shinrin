import type { Tool, ToolDefinition } from '../tool';
import { ankiRequest } from './ankiClient';
import type { KanjiFields, VocabFields } from './noteTypes';
import { toJsonObjectSchema, type JsonValue } from '#lib/json.js';

const KANJI_MODEL = 'Japanese Kanji';
const JAPANESE_VOCAB_MODEL = 'Japanese vocab';
const MANDARIN_VOCAB_MODEL = 'Mandarin vocab';

type NoteField = { value: string; order: number };

type RawNoteInfo = {
	noteId: number;
	modelName: string;
	fields: Record<string, NoteField>;
	tags: string[];
	cards: number[];
};

type NoteInfo = {
	noteId: number;
	modelName: string;
	tags: string[];
	cards: number[];
	fields: KanjiFields | VocabFields;
};

function buildNote(note: RawNoteInfo, fields: KanjiFields | VocabFields): NoteInfo {
	return {
		noteId: note.noteId,
		modelName: note.modelName,
		tags: note.tags,
		cards: note.cards,
		fields
	};
}

export class GetNoteInfoTool implements Tool {
	definition: ToolDefinition = {
		name: 'get_note_info',
		description:
			'Returns full note data (fields, tags, model) for a list of note IDs. Use this on a small, targeted set of IDs from find_notes — not on large results.',
		parameters: toJsonObjectSchema({
			noteIds: {
				type: 'array',
				items: { type: 'integer' },
				description: 'Array of note IDs to fetch'
			}
		})
	};

	async execute(args: Record<string, JsonValue>, signal: AbortSignal): Promise<string> {
		const notes = await ankiRequest<RawNoteInfo[]>('notesInfo', { notes: args.noteIds }, signal);

		const cleanedNotes = notes.map((note) => {
			if (note.modelName === KANJI_MODEL) {
				const f = note.fields;
				const cleanedFields: KanjiFields = {
					Kanji: f.Kanji.value,
					Words: f.Words.value,
					Onyomi: f.Onyomi.value,
					Kunyomi: f.Kunyomi.value
				};
				return buildNote(note, cleanedFields);
			} else if (
				note.modelName === JAPANESE_VOCAB_MODEL ||
				note.modelName === MANDARIN_VOCAB_MODEL
			) {
				const f = note.fields;
				const cleanedFields: VocabFields = {
					Expression: f.Expression.value,
					Reading: f.Reading.value,
					Sentence: f.Sentence.value,
					Nuance: f.Nuance.value
				};
				return buildNote(note, cleanedFields);
			} else {
				return buildNote(note, note.fields as unknown as VocabFields);
			}
		});

		return JSON.stringify(cleanedNotes);
	}
}
