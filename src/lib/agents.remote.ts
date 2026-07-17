import { query, command, form } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { agentSubagents, agentTools, agents, sessions } from '$lib/server/db/schema';
import { insertSessionSchema } from '$lib/server/db/schemas';
import { and, desc, eq, isNull, type InferSelectModel } from 'drizzle-orm';
import * as v from 'valibot';

/** Returns all non-deleted agents. */
export const getAgents = query(async () => {
	return db.select().from(agents).where(isNull(agents.deletedAt));
});

export type Agent = InferSelectModel<typeof agents>;

/** Returns a single agent by id, along with the ids of its assigned tools and subagents. */
export const getAgentById = query(v.pipe(v.string(), v.uuid()), async (id) => {
	const agent = await db.query.agents.findFirst({
		where: eq(agents.id, id),
		with: { agentTools: true, subagents: true }
	});
	if (!agent) {
		error(404, 'Agent not found');
	}
	const { agentTools: assignedTools, subagents: assignedSubagents, ...rest } = agent;
	return {
		...rest,
		toolIds: assignedTools.map((t) => t.toolId),
		subagentIds: assignedSubagents.map((s) => s.subagentId)
	};
});

/**
 * Walks the `agent_subagents` graph backward from `agentId` to find every agent that can
 * already reach it (directly or transitively). Assigning any of these as a subagent of
 * `agentId` would close a cycle.
 */
async function computeAncestorIds(agentId: string): Promise<Set<string>> {
	const edges = await db.select().from(agentSubagents);
	const parentsOf = new Map<string, string[]>();
	for (const edge of edges) {
		if (!parentsOf.has(edge.subagentId)) parentsOf.set(edge.subagentId, []);
		parentsOf.get(edge.subagentId)!.push(edge.agentId);
	}

	const ancestors = new Set<string>();
	const queue = [agentId];
	while (queue.length > 0) {
		const current = queue.shift()!;
		for (const parent of parentsOf.get(current) ?? []) {
			if (!ancestors.has(parent)) {
				ancestors.add(parent);
				queue.push(parent);
			}
		}
	}
	return ancestors;
}

/**
 * Returns agents flagged `isSubagent` that can be assigned to `agentId` without creating a
 * cycle. Pass `null` for a not-yet-created agent, since it can't be anyone's ancestor yet.
 */
export const getAssignableSubagents = query(
	v.nullable(v.pipe(v.string(), v.uuid())),
	async (agentId) => {
		const candidates = await db
			.select()
			.from(agents)
			.where(and(eq(agents.isSubagent, true), isNull(agents.deletedAt)));
		if (!agentId) return candidates;
		const ancestors = await computeAncestorIds(agentId);
		return candidates.filter((c) => c.id !== agentId && !ancestors.has(c.id));
	}
);

/** Returns all sessions for the given agent. */
export const getAgentSessions = query(v.pipe(v.string(), v.uuid()), async (agentId) => {
	const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
	if (!agent) {
		error(404, 'Agent not found');
	}
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
		.innerJoin(agents, eq(sessions.agentId, agents.id))
		.orderBy(desc(sessions.createdAt));
});

/** Creates a new session for the given agent. */
export const createSession = command(
	v.pick(insertSessionSchema, ['agentId', 'name', 'model', 'systemPrompt']),
	async ({ agentId, name, model, systemPrompt }) => {
		const [session] = await db
			.insert(sessions)
			.values({ agentId, name, model, systemPrompt })
			.returning();
		await getAllSessions().refresh();
		return session;
	}
);

/** Creates or updates an agent's name, system prompt, and assigned tools. */
export const saveAgent = form(
	v.object({
		id: v.optional(v.pipe(v.string(), v.uuid())),
		name: v.pipe(v.string(), v.nonEmpty()),
		systemPrompt: v.string(),
		isSubagent: v.optional(v.boolean(), false),
		subagentDescription: v.optional(v.string(), ''),
		defaultModel: v.optional(v.string(), ''),
		toolIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
		subagentIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), [])
	}),
	async ({
		id,
		name,
		systemPrompt,
		isSubagent,
		subagentDescription,
		defaultModel,
		toolIds,
		subagentIds
	}) => {
		const agent = await db.transaction(async (tx) => {
			const values = {
				name,
				systemPrompt: systemPrompt.trim() === '' ? null : systemPrompt,
				isSubagent,
				subagentDescription:
					isSubagent && subagentDescription.trim() !== '' ? subagentDescription : null,
				defaultModel: isSubagent && defaultModel.trim() !== '' ? defaultModel : null
			};

			let agent;
			if (id) {
				[agent] = await tx
					.update(agents)
					.set({ ...values, updatedAt: new Date() })
					.where(eq(agents.id, id))
					.returning();
				if (!agent) {
					error(404, 'Agent not found');
				}
				await tx.delete(agentTools).where(eq(agentTools.agentId, id));
				await tx.delete(agentSubagents).where(eq(agentSubagents.agentId, id));
			} else {
				[agent] = await tx.insert(agents).values(values).returning();
			}

			if (toolIds.length > 0) {
				await tx
					.insert(agentTools)
					.values(toolIds.map((toolId) => ({ agentId: agent.id, toolId })));
			}

			if (subagentIds.length > 0) {
				const ancestors = await computeAncestorIds(agent.id);
				const invalid = subagentIds.filter((sid) => sid === agent.id || ancestors.has(sid));
				if (invalid.length > 0) {
					error(400, 'Cannot assign a subagent that would create a cycle');
				}
				await tx
					.insert(agentSubagents)
					.values(subagentIds.map((subagentId) => ({ agentId: agent.id, subagentId })));
			}

			return agent;
		});

		await getAgents().refresh();
		if (id) {
			await getAgentById(id).refresh();
		}
		return agent;
	}
);

/** Soft-deletes an agent; its sessions, memories, and other history are left intact. */
export const deleteAgent = command(v.pipe(v.string(), v.uuid()), async (id) => {
	await db.update(agents).set({ deletedAt: new Date() }).where(eq(agents.id, id));
});
