import { query } from '$app/server';
import { db } from '$lib/server/db';
import { agents, studyTopics } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

/** Returns all study topics across all agents, including the agent name. */
export const getAllTopics = query(async () => {
	return db
		.select({
			id: studyTopics.id,
			topic: studyTopics.topic,
			status: studyTopics.status,
			notes: studyTopics.notes,
			agentId: studyTopics.agentId,
			agentName: agents.name,
			updatedAt: studyTopics.updatedAt
		})
		.from(studyTopics)
		.innerJoin(agents, eq(studyTopics.agentId, agents.id))
		.orderBy(desc(studyTopics.updatedAt));
});
