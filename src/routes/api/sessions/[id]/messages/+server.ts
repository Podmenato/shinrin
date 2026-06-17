import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { messages, sessions } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/** Returns all messages for the given session, ordered by creation time. */
export const GET: RequestHandler = async ({ params }) => {
	const session = await db.query.sessions.findFirst({ where: eq(sessions.id, params.id) });
	if (!session) error(404, 'Session not found');

	const result = await db
		.select()
		.from(messages)
		.where(eq(messages.sessionId, params.id))
		.orderBy(asc(messages.createdAt));

	return json(result);
};
