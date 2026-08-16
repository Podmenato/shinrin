import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { agents, memories } from '../db/schema';
import { SaveMemoryTool } from './saveMemoryTool';
import { DeleteMemoryTool } from './deleteMemoryTool';
import { ToolError } from './tool';

afterEach(async () => {
	await db.delete(memories);
	await db.delete(agents);
});

async function seedAgent(name = 'agent') {
	const [agent] = await db.insert(agents).values({ name }).returning();
	return agent;
}

describe('DeleteMemoryTool', () => {
	it('soft-deletes an existing memory', async () => {
		const agent = await seedAgent();
		await new SaveMemoryTool(agent.id).execute({ key: 'k', value: 'v' });
		const tool = new DeleteMemoryTool(agent.id);

		const result = await tool.execute({ key: 'k' });

		expect(result).toBe('Memory deleted: "k"');
		const [row] = await db.select().from(memories).where(eq(memories.agentId, agent.id));
		expect(row.deletedAt).not.toBeNull();
	});

	it('throws when no memory exists for that key', async () => {
		const agent = await seedAgent();
		const tool = new DeleteMemoryTool(agent.id);

		await expect(tool.execute({ key: 'missing' })).rejects.toThrow(ToolError);
	});

	it('throws when the memory is already deleted', async () => {
		const agent = await seedAgent();
		await new SaveMemoryTool(agent.id).execute({ key: 'k', value: 'v' });
		const tool = new DeleteMemoryTool(agent.id);
		await tool.execute({ key: 'k' });

		await expect(tool.execute({ key: 'k' })).rejects.toThrow(ToolError);
	});

	it("does not delete another agent's memory with the same key", async () => {
		const agent = await seedAgent('agent');
		const otherAgent = await seedAgent('other');
		await new SaveMemoryTool(agent.id).execute({ key: 'k', value: 'v' });

		await expect(new DeleteMemoryTool(otherAgent.id).execute({ key: 'k' })).rejects.toThrow(
			ToolError
		);
	});
});
