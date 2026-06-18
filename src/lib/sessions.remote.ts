import { command } from '$app/server';
import { db } from '$lib/server/db';
import { sessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { Agent } from '$lib/server/agent';
import { OllamaProvider } from '$lib/server/modelProviders/ollamaProvider';
import * as v from 'valibot';

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
	return await agent.run(prompt);
});
