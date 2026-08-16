import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { subjects, studyTopics } from '../db/schema';
import { CreateTopicTool } from './createTopicTool';
import { UpdateTopicTool } from './updateTopicTool';
import { ToolError } from './tool';

afterEach(async () => {
	await db.delete(studyTopics);
	await db.delete(subjects);
});

describe('UpdateTopicTool', () => {
	it('throws when the topic id does not exist', async () => {
		const tool = new UpdateTopicTool();
		await expect(tool.execute({ id: 'missing', text: 'note' })).rejects.toThrow(ToolError);
	});

	it('appends a timestamped note to an existing topic', async () => {
		const [subject] = await db.insert(subjects).values({ name: 'Japanese' }).returning();
		await new CreateTopicTool(subject.id).execute({ topic: 't', status: 'introduced' });
		const [existing] = await db
			.select()
			.from(studyTopics)
			.where(eq(studyTopics.subjectId, subject.id));
		const tool = new UpdateTopicTool();

		const result = await tool.execute({ id: existing.id, text: 'covered basics' });

		expect(result).toBe('Topic updated: "t"');
		const [updated] = await db.select().from(studyTopics).where(eq(studyTopics.id, existing.id));
		expect(updated.notes).toContain('covered basics');
	});
});
