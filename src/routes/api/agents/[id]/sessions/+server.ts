import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { agents, sessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/** Returns all sessions for the given agent. */
export const GET: RequestHandler = async ({ params }) => {
	const agent = await db.query.agents.findFirst({ where: eq(agents.id, params.id) });
	if (!agent) error(404, 'Agent not found');

	const result = await db.select().from(sessions).where(eq(sessions.agentId, params.id));
	return json(result);
};

/** Creates a new session for the given agent. Body: `{ name, model }`. */
export const POST: RequestHandler = async ({ params, request }) => {
	const agent = await db.query.agents.findFirst({ where: eq(agents.id, params.id) });
	if (!agent) error(404, 'Agent not found');

	const { name, model } = await request.json();
	if (!name || !model) error(400, 'name and model are required');

	const [session] = await db
		.insert(sessions)
		.values({ agentId: params.id, name, model })
		.returning();
	return json(session, { status: 201 });
};
