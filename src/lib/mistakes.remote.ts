import { query } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { subjects, mistakeObservations } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import * as v from 'valibot';

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

/** Returns a single mistake observation by id, including the subject name. */
export const getMistakeById = query(v.pipe(v.string(), v.uuid()), async (id) => {
	const [mistake] = await db
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
		.where(eq(mistakeObservations.id, id));
	if (!mistake) {
		error(404, 'Mistake not found');
	}
	return mistake;
});

export type Mistake = Awaited<ReturnType<typeof getMistakeById>>;
