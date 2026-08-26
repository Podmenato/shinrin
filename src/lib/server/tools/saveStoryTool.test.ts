import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { agents, subjects, stories, storyContent } from '../db/schema';
import { SaveStoryTool } from './saveStoryTool';
import { ToolError } from './tool';

afterEach(async () => {
	await db.delete(storyContent);
	await db.delete(stories);
	await db.delete(subjects);
	await db.delete(agents);
});

async function seedSubject() {
	const [agent] = await db.insert(agents).values({ name: 'Test Agent' }).returning();
	const [subject] = await db
		.insert(subjects)
		.values({ name: 'Japanese', autoAddAgentId: agent.id })
		.returning();
	return subject;
}

describe('SaveStoryTool', () => {
	it('throws for an invalid mode', async () => {
		const tool = new SaveStoryTool(null);
		await expect(tool.execute({ mode: 'delete' })).rejects.toThrow(ToolError);
	});

	describe('create', () => {
		it('requires a title', async () => {
			const tool = new SaveStoryTool(null);
			await expect(tool.execute({ mode: 'create' })).rejects.toThrow(ToolError);
		});

		it('creates a story with no content when none is given', async () => {
			const tool = new SaveStoryTool(null);

			const result = await tool.execute({ mode: 'create', title: 'NHK article' });

			expect(result).toBe('Story created (no content yet): "NHK article"');
			const [story] = await db.select().from(stories);
			expect(story.title).toBe('NHK article');
			const content = await db.select().from(storyContent);
			expect(content).toHaveLength(0);
		});

		it('throws if content is given but the agent has no subject', async () => {
			const tool = new SaveStoryTool(null);
			await expect(tool.execute({ mode: 'create', title: 't', content: 'body' })).rejects.toThrow(
				ToolError
			);
		});

		it('creates a story with content for the calling subject', async () => {
			const subject = await seedSubject();
			const tool = new SaveStoryTool(subject.id);

			const result = await tool.execute({
				mode: 'create',
				title: 'NHK article',
				content: 'body text'
			});

			expect(result).toBe('Story created: "NHK article"');
			const [content] = await db
				.select()
				.from(storyContent)
				.where(eq(storyContent.subjectId, subject.id));
			expect(content.content).toBe('body text');
		});
	});

	describe('update', () => {
		it('requires an id', async () => {
			const tool = new SaveStoryTool(null);
			await expect(tool.execute({ mode: 'update', content: 'body' })).rejects.toThrow(ToolError);
		});

		it('requires content', async () => {
			const subject = await seedSubject();
			const [story] = await db.insert(stories).values({ title: 't' }).returning();
			const tool = new SaveStoryTool(subject.id);
			await expect(tool.execute({ mode: 'update', id: story.id })).rejects.toThrow(ToolError);
		});

		it('throws when the story id does not exist', async () => {
			const subject = await seedSubject();
			const tool = new SaveStoryTool(subject.id);
			await expect(
				tool.execute({ mode: 'update', id: 'missing', content: 'body' })
			).rejects.toThrow(ToolError);
		});

		it('upserts content for the calling subject, clearing stale', async () => {
			const subject = await seedSubject();
			const [story] = await db.insert(stories).values({ title: 't' }).returning();
			await db
				.insert(storyContent)
				.values({ storyId: story.id, subjectId: subject.id, content: 'old', stale: true });
			const tool = new SaveStoryTool(subject.id);

			const result = await tool.execute({
				mode: 'update',
				id: story.id,
				content: 'new content'
			});

			expect(result).toBe('Story content saved: "t"');
			const [content] = await db
				.select()
				.from(storyContent)
				.where(eq(storyContent.storyId, story.id));
			expect(content.content).toBe('new content');
			expect(content.stale).toBe(false);
		});
	});
});
