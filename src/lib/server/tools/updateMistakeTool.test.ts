import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { subjects, mistakeObservations } from '../db/schema';
import { CreateMistakeTool } from './createMistakeTool';
import { UpdateMistakeTool } from './updateMistakeTool';
import { ToolError } from './tool';

afterEach(async () => {
	await db.delete(mistakeObservations);
	await db.delete(subjects);
});

describe('UpdateMistakeTool', () => {
	it('throws when the mistake id does not exist', async () => {
		const tool = new UpdateMistakeTool();
		await expect(tool.execute({ id: 'missing', text: 'note' })).rejects.toThrow(ToolError);
	});

	it('appends a timestamped note to an existing mistake', async () => {
		const [subject] = await db.insert(subjects).values({ name: 'Japanese' }).returning();
		await new CreateMistakeTool(subject.id).execute({ title: 't', note: 'initial note' });
		const [existing] = await db
			.select()
			.from(mistakeObservations)
			.where(eq(mistakeObservations.subjectId, subject.id));
		const tool = new UpdateMistakeTool();

		const result = await tool.execute({ id: existing.id, text: 'happened again' });

		expect(result).toBe('Mistake updated: "t"');
		const [updated] = await db
			.select()
			.from(mistakeObservations)
			.where(eq(mistakeObservations.id, existing.id));
		expect(updated.note).toContain('initial note');
		expect(updated.note).toContain('happened again');
	});
});
