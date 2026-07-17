import { query } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { subjects, studyTopics } from '$lib/server/db/schema';
import { desc, eq, getTableColumns, type InferSelectModel } from 'drizzle-orm';
import * as v from 'valibot';

export type Topic = InferSelectModel<typeof studyTopics> & { subjectName: string };

/** Returns all study topics across all subjects, including the subject name. */
export const getAllTopics = query(async (): Promise<Topic[]> => {
	return db
		.select({ ...getTableColumns(studyTopics), subjectName: subjects.name })
		.from(studyTopics)
		.innerJoin(subjects, eq(studyTopics.subjectId, subjects.id))
		.orderBy(desc(studyTopics.updatedAt));
});

/** Returns a single study topic by id, including the subject name. */
export const getTopicById = query(v.pipe(v.string(), v.uuid()), async (id): Promise<Topic> => {
	const [topic] = await db
		.select({ ...getTableColumns(studyTopics), subjectName: subjects.name })
		.from(studyTopics)
		.innerJoin(subjects, eq(studyTopics.subjectId, subjects.id))
		.where(eq(studyTopics.id, id));
	if (!topic) {
		error(404, 'Topic not found');
	}
	return topic;
});
