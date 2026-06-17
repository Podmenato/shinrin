import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { Agent } from '$lib/server/agent';
import { OllamaProvider } from '$lib/server/modelProviders/ollamaProvider';
import type { RequestHandler } from './$types';

/** Runs the agent for the given session with the provided prompt. Body: `{ prompt }`. Returns `{ response }`. */
export const POST: RequestHandler = async ({ params, request }) => {
	const session = await db.query.sessions.findFirst({ where: eq(sessions.id, params.id) });
	if (!session) error(404, 'Session not found');

	const { prompt } = await request.json();
	if (!prompt) error(400, 'prompt is required');

	// TODO: make provider independent
	const provider = new OllamaProvider(session.model);
	const agent = await Agent.createFromSession(params.id, provider);

	// TODO: add streaming
	const response = await agent.run(prompt);

	return json({ response });
};
