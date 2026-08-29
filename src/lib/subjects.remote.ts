import { query, form } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { agents, subjects } from '#lib/server/db/schema.js';
import { ankiRequest } from '#lib/server/tools/anki/ankiClient.js';
import { getAgents } from '#lib/agents.remote.js';
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

const DECK_SLOT_NAMES = { R: 'Reading', P: 'Production', L: 'Listening' } as const;

// "::" is Anki's own deck-hierarchy separator — this groups the three generated
// decks under a collapsible {subjectName} parent in the deck browser.
function defaultDeckName(subjectName: string, slot: 'R' | 'P' | 'L'): string {
	return `${subjectName}::${DECK_SLOT_NAMES[slot]}`;
}

function defaultAutoAddSystemPrompt(subjectName: string): string {
	return (
		'You are a card-completion tool. You generate a single Anki sentence card from a chat excerpt. Given a chat message and a ' +
		'text excerpt the user selected from it, produce one JSON object — nothing else, no prose, ' +
		'no markdown fence — matching exactly:\n' +
		'{"sentence": "...", "translation": "...", "reading": "", "notes": ""}\n' +
		`  sentence    — the ${subjectName} sentence, usually the excerpt itself verbatim; adjust it only if it's a broken fragment.\n` +
		'  translation — its English translation. Almost always the one field you actually need to fill in.\n' +
		`  reading     — a reading aid (furigana, pinyin, etc.) if ${subjectName}'s script needs one; otherwise "".\n` +
		'  notes       — a short grammar/usage note, only when something genuinely needs flagging; otherwise "".\n' +
		'\n' +
		'Your reply is parsed directly as this JSON and used to create the card — it is never shown to the user as a message.'
	);
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
		autoAddAgentId: v.string()
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
		if (id && autoAddAgentId === '') {
			error(400, 'Select an automatic-add agent');
		}

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
			listeningDeck
		};

		let subject;
		if (id) {
			[subject] = await db
				.update(subjects)
				.set({ ...values, autoAddAgentId, updatedAt: new Date() })
				.where(eq(subjects.id, id))
				.returning();
			if (!subject) {
				error(404, 'Subject not found');
			}
		} else {
			let resolvedAgentId = autoAddAgentId;
			if (resolvedAgentId === '') {
				const [defaultAgent] = await db
					.insert(agents)
					.values({ name: `${name} tutor`, systemPrompt: defaultAutoAddSystemPrompt(name) })
					.returning();
				resolvedAgentId = defaultAgent.id;
				await getAgents().refresh();
			}

			[subject] = await db
				.insert(subjects)
				.values({ ...values, autoAddAgentId: resolvedAgentId })
				.returning();

			if (autoAddAgentId === '') {
				await db
					.update(agents)
					.set({ subjectId: subject.id, updatedAt: new Date() })
					.where(eq(agents.id, resolvedAgentId));
			}
		}

		await getSubjects().refresh();
		if (id) {
			await getSubjectById(id).refresh();
		}
		return { subject, deckWarnings };
	}
);
