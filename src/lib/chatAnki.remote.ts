import { command } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { db } from '#lib/server/db/index.js';
import { Agent } from '#lib/server/agent.js';
import { OllamaProvider } from '#lib/server/modelProviders/ollamaProvider.js';
import { AddSentenceNoteTool } from '#lib/server/tools/anki/addSentenceNoteTool.js';
import { ankiRequest } from '#lib/server/tools/anki/ankiClient.js';
import type { JsonValue } from '#lib/json.js';

// TODO: context actions will be redone, review if this still makes sense after
const generatedCardSchema = v.object({
	sentence: v.pipe(v.string(), v.nonEmpty()),
	translation: v.pipe(v.string(), v.nonEmpty()),
	reading: v.optional(v.string(), ''),
	notes: v.optional(v.string(), '')
});

function parseGeneratedCard(reply: string) {
	// Asked for bare JSON, but this is a regular chat turn (no schema-constrained decoding) —
	// strip a markdown code fence if the model wrapped its reply in one before giving up.
	const unfenced = reply.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
	for (const candidate of [reply, unfenced]) {
		try {
			return v.parse(generatedCardSchema, JSON.parse(candidate));
		} catch {
			continue;
		}
	}
	error(502, 'Model returned invalid JSON.');
}

/**
 * `createDeck` is idempotent ("will not overwrite a deck that exists with the same name"), so
 * this is safe to call unconditionally rather than checking existence first. Only used by the
 * automatic path below — the manual dialog's deck pickers only ever offer decks that already
 * exist in Anki, so there's nothing to lazily create there.
 */
async function ensureDecksExist(decks: string[], signal: AbortSignal) {
	await Promise.all(decks.map((deck) => ankiRequest('createDeck', { deck }, signal)));
}

const autoAddSchema = v.object({
	sessionId: v.pipe(v.string(), v.uuid()),
	selectedText: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	messageContent: v.string()
});

/**
 * Quickly adds card to Anki using the subject's decks and generating a sentence using AI.
 */
export const autoAddSentenceCard = command(
	autoAddSchema,
	async ({ sessionId, selectedText, messageContent }) => {
		const session = await db.query.sessions.findFirst({
			where: { id: sessionId },
			with: { agent: { with: { subject: true } } }
		});
		if (!session) {
			error(404, 'Session not found');
		}

		const subject = session.agent.subject;
		if (!subject) {
			error(400, 'This agent has no subject, so there is no automatic-add configuration to use.');
		}

		const decks = [subject.readingDeck, subject.productionDeck, subject.listeningDeck];
		if (decks.some((deck) => !deck)) {
			error(
				400,
				`"${subject.name}" has no decks configured yet — set them in the subject's settings first.`
			);
		}

		const signal = new AbortController().signal;
		const provider = new OllamaProvider(session.model);
		const agent = await Agent.create(
			subject.autoAddAgentId,
			'Automatic sentence card',
			session.model,
			provider,
			sessionId
		);

		const prompt = `Message:\n"""${messageContent}"""\n\nSelected excerpt:\n"""${selectedText}"""`;
		const reply = await agent.run(prompt, undefined, signal);
		const card = parseGeneratedCard(reply);

		await ensureDecksExist(decks as string[], signal);

		const result = await new AddSentenceNoteTool().execute(
			{
				decks,
				sentence: card.sentence,
				translation: card.translation,
				reading: card.reading,
				notes: card.notes,
				tags: []
			} as unknown as Record<string, JsonValue>,
			signal
		);
		return JSON.parse(result) as {
			noteId: number;
			cards: Record<string, { deck: string; cardId: number }>;
		};
	}
);

const addSentenceCardSchema = v.object({
	decks: v.pipe(v.array(v.pipe(v.string(), v.nonEmpty())), v.length(3)),
	sentence: v.pipe(v.string(), v.nonEmpty()),
	translation: v.pipe(v.string(), v.nonEmpty()),
	reading: v.optional(v.string()),
	notes: v.optional(v.string()),
	tags: v.optional(v.array(v.string()), [])
});

/** Writes a sentence note to Anki. */
export const addSentenceCard = command(addSentenceCardSchema, async (args) => {
	const signal = new AbortController().signal;
	const result = await new AddSentenceNoteTool().execute(
		args as unknown as Record<string, JsonValue>,
		signal
	);
	return JSON.parse(result) as {
		noteId: number;
		cards: Record<string, { deck: string; cardId: number }>;
	};
});
