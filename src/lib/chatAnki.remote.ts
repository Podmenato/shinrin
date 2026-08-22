import { command } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { db } from '#lib/server/db/index.js';
import { Agent } from '#lib/server/agent.js';
import { OllamaProvider } from '#lib/server/modelProviders/ollamaProvider.js';
import { AddSentenceNoteTool } from '#lib/server/tools/anki/addSentenceNoteTool.js';
import type { JsonValue } from '#lib/json.js';

// TODO: context actions will be redone, review if this still makes sense after
const generateSentenceCardSchema = v.object({
	sessionId: v.pipe(v.string(), v.uuid()),
	selectedText: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	messageContent: v.string()
});

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
 * Generates sentence-card fields from a chat-message text selection by running the session's own
 * agent as a hidden nested session (same mechanism `SubagentTool` uses for subagent calls) —
 * kept out of the visible transcript rather than injected as a real turn in the current session.
 * Which agent/model handles this is meant to become user-configurable later; for now it's always
 * whatever agent the calling session is already running.
 */
export const generateSentenceCard = command(
	generateSentenceCardSchema,
	async ({ sessionId, selectedText, messageContent }) => {
		const session = await db.query.sessions.findFirst({
			where: { id: sessionId },
			with: { agent: { with: { subject: true } } }
		});
		if (!session) {
			error(404, 'Session not found');
		}

		const subjectName = session.agent.subject?.name;
		if (!subjectName) {
			error(
				400,
				'This agent has no subject, so AI sentence generation has no target language to use.'
			);
		}

		const provider = new OllamaProvider(session.model);
		const agent = await Agent.create(
			session.agentId,
			'Sentence card generation',
			session.model,
			provider,
			sessionId
		);

		const prompt =
			`Generate a single Anki sentence card grounded in the excerpt below. Target language: ${subjectName}.\n` +
			'Reply with ONLY a single JSON object, no prose before or after it, no markdown code fence, matching exactly:\n' +
			'{"sentence": string, "translation": string, "reading": string, "notes": string}\n' +
			'  sentence — one natural example sentence in the target language, using or relating to the excerpt.\n' +
			'  translation — its English translation.\n' +
			'  reading — furigana or pinyin reading of the sentence. Empty string if the language uses no such reading.\n' +
			'  notes — a brief grammar or nuance note. Empty string if there is nothing worth adding.\n\n' +
			`Message:\n"""${messageContent}"""\n\n` +
			`Selected excerpt:\n"""${selectedText}"""`;

		const reply = await agent.run(prompt, undefined, new AbortController().signal);
		return parseGeneratedCard(reply);
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

/** Writes a sentence note to Anki — the same shape/write path as the `add_sentence_note` agent tool. */
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
