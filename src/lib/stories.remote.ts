import { query } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import * as v from 'valibot';

/** Returns all stories with the subjects they currently have content in. */
export const getAllStories = query(async () => {
	const rows = await db.query.stories.findMany({
		orderBy: { updatedAt: 'desc' },
		with: {
			content: {
				columns: { subjectId: true },
				with: { subject: { columns: { name: true } } }
			}
		}
	});

	return rows.map(({ content, ...story }) => ({
		...story,
		subjectNames: content.map((entry) => entry.subject.name)
	}));
});

/** Returns a single story by id, with its content and resources. */
export const getStoryById = query(v.pipe(v.string(), v.uuid()), async (id) => {
	const story = await db.query.stories.findFirst({
		where: { id },
		with: {
			content: { with: { subject: true } },
			resources: { with: { file: true } }
		}
	});
	if (!story) {
		error(404, 'Story not found');
	}
	return story;
});

export type Story = Awaited<ReturnType<typeof getAllStories>>[number];
export type StoryDetail = Awaited<ReturnType<typeof getStoryById>>;
