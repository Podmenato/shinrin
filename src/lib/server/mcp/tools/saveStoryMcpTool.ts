import * as v from 'valibot';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import { McpServer } from '@modelcontextprotocol/server';
import { eq } from 'drizzle-orm';
import { stories, storyContent, subjects } from '../../db/schema';
import type { Db } from '../../db/createDb';

export async function registerSaveStoryMcpTool(server: McpServer, db: Db) {
	const subjectRows = await db.select().from(subjects);
	const subjectNames = subjectRows.map((s) => s.name);

	const argsSchema = v.object({
		mode: v.picklist(['create', 'update']),
		subject: v.picklist(subjectNames),
		title: v.optional(v.string()),
		id: v.optional(v.string()),
		content: v.pipe(v.string(), v.nonEmpty())
	});

	server.registerTool(
		'save_story',
		{
			title: 'Save story',
			description:
				"Save a story's content under a chosen subject — a saved article, a roleplay transcript, " +
				'a logged work/study session, or any other reusable content an external tool wants to ' +
				"hand off. mode 'create' starts a new story — title required. mode 'update' overwrites " +
				"an existing story's " +
				'content for the chosen subject, identified by id — use the id returned from a prior ' +
				"'create' or 'update' call, there is no separate lookup.",
			inputSchema: toStandardJsonSchema(argsSchema)
		},
		async ({ mode, subject, title, id, content }) => {
			const subjectRow = subjectRows.find((s) => s.name === subject)!;

			if (mode === 'create') {
				if (!title) {
					return {
						content: [{ type: 'text', text: "title is required when mode is 'create'." }],
						isError: true
					};
				}
				const [story] = await db.insert(stories).values({ title }).returning();
				await db
					.insert(storyContent)
					.values({ storyId: story.id, subjectId: subjectRow.id, content });
				return {
					content: [{ type: 'text', text: `Story created: "${title}" (id: ${story.id})` }]
				};
			}

			if (!id) {
				return {
					content: [{ type: 'text', text: "id is required when mode is 'update'." }],
					isError: true
				};
			}
			const [story] = await db.select().from(stories).where(eq(stories.id, id));
			if (!story) {
				return {
					content: [{ type: 'text', text: `No story found with id "${id}".` }],
					isError: true
				};
			}
			await db
				.insert(storyContent)
				.values({ storyId: id, subjectId: subjectRow.id, content })
				.onConflictDoUpdate({
					target: [storyContent.storyId, storyContent.subjectId],
					set: { content, stale: false, updatedAt: new Date() }
				});
			return { content: [{ type: 'text', text: `Story content saved: "${story.title}"` }] };
		}
	);
}
