import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { agents, memories } from '../db/schema';
import { SaveMemoryTool } from './saveMemoryTool';

afterEach(async () => {
	await db.delete(memories);
	await db.delete(agents);
});

async function seedAgent() {
	const [agent] = await db.insert(agents).values({ name: 'agent' }).returning();
	return agent;
}

describe('SaveMemoryTool', () => {
	it('creates a new memory', async () => {
		const agent = await seedAgent();
		const tool = new SaveMemoryTool(agent.id);

		const result = await tool.execute({ key: 'jlpt_level', value: 'N3' });

		expect(result).toBe('Memory saved: "jlpt_level"');
		const [row] = await db.select().from(memories).where(eq(memories.agentId, agent.id));
		expect(row.value).toBe('N3');
	});

	it('overwrites an existing memory for the same key, undeleting it if soft-deleted', async () => {
		const agent = await seedAgent();
		const tool = new SaveMemoryTool(agent.id);
		await tool.execute({ key: 'jlpt_level', value: 'N3' });
		await db.update(memories).set({ deletedAt: new Date() }).where(eq(memories.agentId, agent.id));

		await tool.execute({ key: 'jlpt_level', value: 'N2' });

		const [row] = await db.select().from(memories).where(eq(memories.agentId, agent.id));
		expect(row.value).toBe('N2');
		expect(row.deletedAt).toBeNull();
	});
});
