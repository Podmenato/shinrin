import { query } from '$app/server';
import { db } from '$lib/server/db';
import { agents, mistakeObservations } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

/** Returns all mistake observations across all agents, including the agent name. */
export const getAllMistakes = query(async () => {
	return db
		.select({
			id: mistakeObservations.id,
			title: mistakeObservations.title,
			note: mistakeObservations.note,
			agentId: mistakeObservations.agentId,
			agentName: agents.name,
			createdAt: mistakeObservations.createdAt
		})
		.from(mistakeObservations)
		.innerJoin(agents, eq(mistakeObservations.agentId, agents.id))
		.orderBy(desc(mistakeObservations.createdAt));
});
