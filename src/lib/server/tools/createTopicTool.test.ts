import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { subjects, studyTopics } from '../db/schema';
import { CreateTopicTool } from './createTopicTool';
import { ToolError } from './tool';

afterEach(async () => {
	await db.delete(studyTopics);
	await db.delete(subjects);
});

async function seedSubject() {
	const [subject] = await db.insert(subjects).values({ name: 'Japanese' }).returning();
	return subject;
}

describe('CreateTopicTool', () => {
	it('throws when the agent has no subject', async () => {
		const tool = new CreateTopicTool(null);
		await expect(tool.execute({ topic: 't', status: 'introduced' })).rejects.toThrow(ToolError);
	});

	it('throws for an invalid status', async () => {
		const subject = await seedSubject();
		const tool = new CreateTopicTool(subject.id);
		await expect(tool.execute({ topic: 't', status: 'fluent' })).rejects.toThrow(ToolError);
	});

	it('creates a topic', async () => {
		const subject = await seedSubject();
		const tool = new CreateTopicTool(subject.id);

		const result = await tool.execute({
			topic: 'べき grammar',
			status: 'introduced',
			notes: 'first pass'
		});

		expect(result).toBe('Topic created: "べき grammar" → introduced');
		const [row] = await db.select().from(studyTopics).where(eq(studyTopics.subjectId, subject.id));
		expect(row.status).toBe('introduced');
		expect(row.notes).toBe('first pass');
	});

	it('throws when a topic with the same name already exists for the subject', async () => {
		const subject = await seedSubject();
		const tool = new CreateTopicTool(subject.id);
		await tool.execute({ topic: 't', status: 'introduced' });

		await expect(tool.execute({ topic: 't', status: 'practicing' })).rejects.toThrow(ToolError);
	});
});
