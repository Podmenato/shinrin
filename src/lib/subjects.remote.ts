import { query, form } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { subjects } from '#lib/server/db/schema.js';
import { ankiRequest } from '#lib/server/tools/anki/ankiClient.js';
import { eq, type InferSelectModel } from 'drizzle-orm';
import * as v from 'valibot';

/** Returns all subjects. */
export const getSubjects = query(async () => {
	return db.select().from(subjects).orderBy(subjects.name);
});

export type Subject = InferSelectModel<typeof subjects>;

/** Returns a single subject by id. */
export const getSubjectById = query(v.pipe(v.string(), v.uuid()), async (id) => {
	const subject = await db.query.subjects.findFirst({ where: { id } });
	if (!subject) {
		error(404, 'Subject not found');
	}
	return subject;
});

function defaultDeckName(subjectName: string, slot: 'R' | 'P' | 'L'): string {
	return `${subjectName} generated (${slot})`;
}

/**
 * Returns `selectedDeck` unchanged, or — if nothing was selected — creates the
 * `{subjectName} generated ({slot})` deck and returns its name. Returns `null` if creating it
 * fails (and appends an explanation to `warnings`).
 */
async function getOrCreateDeck(
	subjectName: string,
	slot: 'R' | 'P' | 'L',
	selectedDeck: string,
	warnings: string[],
	signal: AbortSignal
): Promise<string | null> {
	if (selectedDeck.trim() !== '') {
		return selectedDeck;
	}
	const deckName = defaultDeckName(subjectName, slot);
	try {
		await ankiRequest('createDeck', { deck: deckName }, signal);
		return deckName;
	} catch {
		warnings.push(
			`Could not create "${deckName}" in Anki — it'll be created the first time a card is added, or set it manually in the meantime.`
		);
		return null;
	}
}

/** Creates or updates a subject: name, description, default decks, and default automatic-add agent. */
export const saveSubject = form(
	v.object({
		id: v.optional(v.pipe(v.string(), v.uuid())),
		name: v.pipe(v.string(), v.nonEmpty()),
		description: v.string(),
		readingDeck: v.string(),
		productionDeck: v.string(),
		listeningDeck: v.string(),
		autoAddAgentId: v.pipe(v.string(), v.uuid())
	}),
	async ({
		id,
		name,
		description,
		readingDeck: readingDeckInput,
		productionDeck: productionDeckInput,
		listeningDeck: listeningDeckInput,
		autoAddAgentId
	}) => {
		const signal = new AbortController().signal;
		const deckWarnings: string[] = [];

		const [readingDeck, productionDeck, listeningDeck] = await Promise.all([
			getOrCreateDeck(name, 'R', readingDeckInput, deckWarnings, signal),
			getOrCreateDeck(name, 'P', productionDeckInput, deckWarnings, signal),
			getOrCreateDeck(name, 'L', listeningDeckInput, deckWarnings, signal)
		]);

		const values = {
			name,
			description: description.trim() === '' ? null : description,
			readingDeck,
			productionDeck,
			listeningDeck,
			autoAddAgentId
		};

		let subject;
		if (id) {
			[subject] = await db
				.update(subjects)
				.set({ ...values, updatedAt: new Date() })
				.where(eq(subjects.id, id))
				.returning();
			if (!subject) {
				error(404, 'Subject not found');
			}
		} else {
			[subject] = await db.insert(subjects).values(values).returning();
		}

		await getSubjects().refresh();
		if (id) {
			await getSubjectById(id).refresh();
		}
		return { subject, deckWarnings };
	}
);
