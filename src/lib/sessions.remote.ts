import { command, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { messages, sessions } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import { Agent } from '$lib/server/agent';
import { OllamaProvider } from '$lib/server/modelProviders/ollamaProvider';
import { sessionStreams } from '$lib/server/sessionStreamRegistry';
import * as v from 'valibot';

/** Returns a session along with its agent, for display in the chat screen header. */
export const getSession = query(v.pipe(v.string(), v.uuid()), async (sessionId) => {
	const session = await db.query.sessions.findFirst({
		where: eq(sessions.id, sessionId),
		with: { agent: true }
	});
	if (!session) {
		error(404, 'Session not found');
	}
	return session;
});

/**
 * Returns a session's messages in order, with any tool calls attached, excluding system messages.
 *
 * TODO: this is a plain `query()`, refreshed via single-flight from `runAgent` — which only
 * reaches the browser tab that actually called `runAgent`. A page reload or a second tab
 * watching the same session never sees the refresh, so `+page.svelte` currently papers over
 * this with a client-side `$effect` that force-refreshes once generation ends. The correct
 * fix is to make this a `query.live()` backed by a notify signal fired from
 * `ContextManager.add()` (the one choke point every persisted message goes through), using
 * the same abort-aware wait/notify shape as `SessionStreamRegistry`. That would also be the
 * natural foundation for live tool-call-in-progress visibility (see project roadmap), since
 * both problems are "the message list should update live, not just once at the end."
 */
export const getSessionMessages = query(v.pipe(v.string(), v.uuid()), async (sessionId) => {
	const rows = await db.query.messages.findMany({
		where: eq(messages.sessionId, sessionId),
		orderBy: asc(messages.createdAt),
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
				args: tc.args as Record<string, string>
			}))
		}));
});

const runSchema = v.object({
	sessionId: v.pipe(v.string(), v.uuid()),
	prompt: v.pipe(v.string(), v.nonEmpty())
});

/** Streams the in-progress assistant reply for a session; `null` while no run is active. */
export const getStreamingReply = query.live(v.pipe(v.string(), v.uuid()), (sessionId) =>
	sessionStreams.subscribe(sessionId)
);

/** Runs the agent for the given session with the provided prompt. */
export const runAgent = command(runSchema, async ({ sessionId, prompt }) => {
	const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
	if (!session) {
		error(404, 'Session not found');
	}

	// TODO: make provider independent
	const provider = new OllamaProvider(session.model);
	const agent = await Agent.createFromSession(sessionId, provider);

	sessionStreams.start(sessionId);
	try {
		return await agent.run(prompt, (delta) => sessionStreams.append(sessionId, delta));
	} finally {
		await getSessionMessages(sessionId).refresh();
		sessionStreams.end(sessionId);
	}
});
