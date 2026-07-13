import { command, query } from '$app/server';
import { db } from '$lib/server/db';
import { messages, sessions } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import { Agent } from '$lib/server/agent';
import { OllamaProvider } from '$lib/server/modelProviders/ollamaProvider';
import * as v from 'valibot';

/** Returns a session along with its agent, for display in the chat screen header. */
export const getSession = query(v.pipe(v.string(), v.uuid()), async (sessionId) => {
	const session = await db.query.sessions.findFirst({
		where: eq(sessions.id, sessionId),
		with: { agent: true }
	});
	if (!session) throw new Error('Session not found');
	return session;
});

/** Returns a session's messages in order, with any tool calls attached, excluding system messages. */
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

/** Runs the agent for the given session with the provided prompt. */
export const runAgent = command(runSchema, async ({ sessionId, prompt }) => {
	const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
	if (!session) throw new Error('Session not found');

	// TODO: make provider independent
	const provider = new OllamaProvider(session.model);
	const agent = await Agent.createFromSession(sessionId, provider);
	const result = await agent.run(prompt);

	await getSessionMessages(sessionId).refresh();
	return result;
});
