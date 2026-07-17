import { query } from '$app/server';
import { db } from '$lib/server/db';
import { subjects, mistakeObservations } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

/** Returns all mistake observations across all subjects, including the subject name. */
export const getAllMistakes = query(async () => {
	return db
		.select({
			id: mistakeObservations.id,
			title: mistakeObservations.title,
			note: mistakeObservations.note,
			subjectId: mistakeObservations.subjectId,
			subjectName: subjects.name,
			createdAt: mistakeObservations.createdAt
		})
		.from(mistakeObservations)
		.innerJoin(subjects, eq(mistakeObservations.subjectId, subjects.id))
		.orderBy(desc(mistakeObservations.createdAt));
});
