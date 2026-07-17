import { query } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { agents, studyTopics } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import * as v from 'valibot';

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

/** Returns a single study topic by id, including the agent name. */
export const getTopicById = query(v.pipe(v.string(), v.uuid()), async (id) => {
	const [topic] = await db
		.select({
			id: studyTopics.id,
			topic: studyTopics.topic,
			status: studyTopics.status,
			notes: studyTopics.notes,
			agentId: studyTopics.agentId,
			agentName: agents.name,
			createdAt: studyTopics.createdAt,
			updatedAt: studyTopics.updatedAt
		})
		.from(studyTopics)
		.innerJoin(agents, eq(studyTopics.agentId, agents.id))
		.where(eq(studyTopics.id, id));
	if (!topic) {
		error(404, 'Topic not found');
	}
	return topic;
});
