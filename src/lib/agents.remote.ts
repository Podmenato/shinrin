import { query, command, form } from '$app/server';
import { db } from '$lib/server/db';
import { agents, sessions } from '$lib/server/db/schema';
import { insertSessionSchema } from '$lib/server/db/schemas';
import { eq, isNull, type InferSelectModel } from 'drizzle-orm';
import * as v from 'valibot';

/** Returns all non-deleted agents. */
export const getAgents = query(async () => {
	return db.select().from(agents).where(isNull(agents.deletedAt));
});

export type Agent = InferSelectModel<typeof agents>;

/** Returns a single agent by id. */
export const getAgentById = query(v.pipe(v.string(), v.uuid()), async (id) => {
	const agent = await db.query.agents.findFirst({ where: eq(agents.id, id) });
	if (!agent) throw new Error('Agent not found');
	return agent;
});

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

/** Updates an agent's name and system prompt. */
export const updateAgent = form(
	v.object({
		id: v.pipe(v.string(), v.uuid()),
		name: v.pipe(v.string(), v.nonEmpty()),
		systemPrompt: v.string()
	}),
	async ({ id, name, systemPrompt }) => {
		const [agent] = await db
			.update(agents)
			.set({
				name,
				systemPrompt: systemPrompt.trim() === '' ? null : systemPrompt,
				updatedAt: new Date()
			})
			.where(eq(agents.id, id))
			.returning();
		if (!agent) {
			throw new Error('Agent not found');
		}
		await getAgents().refresh();
		await getAgentById(id).refresh();
		return agent;
	}
);

/** Soft-deletes an agent; its sessions, memories, and other history are left intact. */
export const deleteAgent = command(v.pipe(v.string(), v.uuid()), async (id) => {
	await db.update(agents).set({ deletedAt: new Date() }).where(eq(agents.id, id));
});
