import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { sessions } from '#lib/server/db/schema.js';
import { Agent } from '#lib/server/agent.js';
import { OllamaProvider } from '#lib/server/modelProviders/ollamaProvider.js';
import { sessionRegistry } from '#lib/server/sessionRegistry.js';
import { messageRegistry } from '#lib/server/messageRegistry.js';
import { getAllSessions } from '#lib/agents.remote.js';
import type { JsonValue } from '#lib/json.js';
import * as v from 'valibot';

/** Returns a session along with its agent, for display in the chat screen header. */
export const getSession = query(v.pipe(v.string(), v.uuid()), async (sessionId) => {
	const session = await db.query.sessions.findFirst({
		where: { id: sessionId },
		with: { agent: { with: { subject: true } } }
	});
	if (!session) {
		error(404, 'Session not found');
	}
	return session;
});

/**
 * Get session messages from DB, excluding system messages
 * @param sessionId
 */
async function getSessionMessages(sessionId: string) {
	const rows = await db.query.messages.findMany({
		where: { sessionId },
		orderBy: { createdAt: 'asc' },
		with: { messageToolCalls: { with: { tool: true } } }
	});

	return rows
		.filter((m) => m.role !== 'system')
		.map((m) => ({
			id: m.id,
			role: m.role as 'user' | 'assistant' | 'tool',
			content: m.content,
			toolName: m.toolName ?? undefined,
			createdAt: m.createdAt,
			toolCalls: m.messageToolCalls.map((tc) => ({
				name: tc.tool.name,
				args: tc.args as Record<string, JsonValue>
			}))
		}));
}

/**
 * Live query returning session's messages excluding system messages. Re-fetches and re-yields
 * whenever `ContextManager.add()` persists a message for this session
 */
export const getSessionMessagesQuery = query.live(
	v.pipe(v.string(), v.uuid()),
	async function* (sessionId) {
		const { signal } = getRequestEvent().request;

		yield null;

		while (!signal.aborted) {
			yield await getSessionMessages(sessionId);
			await messageRegistry.next(sessionId, signal);
		}
	}
);

const runSchema = v.object({
	sessionId: v.pipe(v.string(), v.uuid()),
	prompt: v.pipe(v.string(), v.nonEmpty())
});

/** Streams the in-progress assistant reply for a session; `null` while no run is active. */
export const getStreamingReply = query.live(v.pipe(v.string(), v.uuid()), (sessionId) =>
	sessionRegistry.subscribe(sessionId)
);

/** Runs the agent for the given session with the provided prompt. */
export const runAgent = command(runSchema, async ({ sessionId, prompt }) => {
	const session = await db.query.sessions.findFirst({ where: { id: sessionId } });
	if (!session) {
		error(404, 'Session not found');
	}

	// TODO: make provider independent
	const provider = new OllamaProvider(session.model);
	const agent = await Agent.createFromSession(sessionId, provider, prompt);
	const controller = new AbortController();

	sessionRegistry.start(sessionId, controller);
	try {
		return await agent.run(
			prompt,
			(delta) => sessionRegistry.append(sessionId, delta),
			controller.signal
		);
	} finally {
		sessionRegistry.end(sessionId);
	}
});

/** Cancels a session's in-progress `runAgent` call, if one is active. */
export const cancelAgent = command(v.pipe(v.string(), v.uuid()), async (sessionId) => {
	sessionRegistry.cancel(sessionId);
});

/** Changes the model a session runs on. Rejected while a run is in flight. */
export const updateSessionModel = command(
	v.object({
		sessionId: v.pipe(v.string(), v.uuid()),
		model: v.pipe(v.string(), v.nonEmpty())
	}),
	async ({ sessionId, model }) => {
		const session = await db.query.sessions.findFirst({ where: { id: sessionId } });
		if (!session) {
			error(404, 'Session not found');
		}

		if (sessionRegistry.get(sessionId) !== null) {
			error(409, 'Cannot change the model while a reply is generating.');
		}

		await db
			.update(sessions)
			.set({ model, updatedAt: new Date() })
			.where(eq(sessions.id, sessionId));

		await Promise.all([getSession(sessionId).refresh(), getAllSessions().refresh()]);
	}
);
