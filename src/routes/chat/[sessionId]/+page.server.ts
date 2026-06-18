import { db } from '$lib/server/db';
import { messages, sessions } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const session = await db.query.sessions.findFirst({
		where: eq(sessions.id, params.sessionId),
		with: { agent: true }
	});

	if (!session) error(404, 'Session not found');

	const messageList = await db
		.select()
		.from(messages)
		.where(eq(messages.sessionId, params.sessionId))
		.orderBy(asc(messages.createdAt));

	return { session, messages: messageList };
};
