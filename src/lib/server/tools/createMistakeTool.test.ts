import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { subjects, mistakeObservations } from '../db/schema';
import { CreateMistakeTool } from './createMistakeTool';
import { ToolError } from './tool';

afterEach(async () => {
	await db.delete(mistakeObservations);
	await db.delete(subjects);
});

describe('CreateMistakeTool', () => {
	it('throws when the agent has no subject', async () => {
		const tool = new CreateMistakeTool(null);
		await expect(tool.execute({ title: 't', note: 'n' })).rejects.toThrow(ToolError);
	});

	it('logs a mistake', async () => {
		const [subject] = await db.insert(subjects).values({ name: 'Japanese' }).returning();
		const tool = new CreateMistakeTool(subject.id);

		const result = await tool.execute({
			title: 'は/が confusion',
			note: 'mixed up topic and subject markers'
		});

		expect(result).toBe('Mistake logged.');
		const [row] = await db
			.select()
			.from(mistakeObservations)
			.where(eq(mistakeObservations.subjectId, subject.id));
		expect(row.title).toBe('は/が confusion');
	});
});
