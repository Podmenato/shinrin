import { query, command } from '$app/server';
import { db } from '$lib/server/db';
import { agents, sessions } from '$lib/server/db/schema';
import { insertSessionSchema } from '$lib/server/db/schemas';
import { eq, type InferSelectModel } from 'drizzle-orm';
import * as v from 'valibot';

/** Returns all agents. */
export const getAgents = query(async () => {
	return db.select().from(agents);
});

export type Agent = InferSelectModel<typeof agents>;

/** Returns all sessions for the given agent. */
export const getAgentSessions = query(v.pipe(v.string(), v.uuid()), async (agentId) => {
	const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
	if (!agent) throw new Error('Agent not found');
	return db.select().from(sessions).where(eq(sessions.agentId, agentId));
});

/** Returns all sessions across all agents, including the agent name. */
export const getAllSessions = query(async () => {
	return db
		.select({
			id: sessions.id,
			name: sessions.name,
			model: sessions.model,
			agentId: sessions.agentId,
			agentName: agents.name,
			createdAt: sessions.createdAt
		})
		.from(sessions)
		.innerJoin(agents, eq(sessions.agentId, agents.id));
});

/** Creates a new session for the given agent. */
export const createSession = command(
	v.pick(insertSessionSchema, ['agentId', 'name', 'model']),
	async ({ agentId, name, model }) => {
		const [session] = await db.insert(sessions).values({ agentId, name, model }).returning();
		return session;
	}
);
