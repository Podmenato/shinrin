import { query, form } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { subjects } from '$lib/server/db/schema';
import { eq, type InferSelectModel } from 'drizzle-orm';
import * as v from 'valibot';

/** Returns all subjects. */
export const getSubjects = query(async () => {
	return db.select().from(subjects).orderBy(subjects.name);
});

export type Subject = InferSelectModel<typeof subjects>;

/** Returns a single subject by id. */
export const getSubjectById = query(v.pipe(v.string(), v.uuid()), async (id) => {
	const subject = await db.query.subjects.findFirst({ where: eq(subjects.id, id) });
	if (!subject) {
		error(404, 'Subject not found');
	}
	return subject;
});

/** Creates or updates a subject's name and description. */
export const saveSubject = form(
	v.object({
		id: v.optional(v.pipe(v.string(), v.uuid())),
		name: v.pipe(v.string(), v.nonEmpty()),
		description: v.string()
	}),
	async ({ id, name, description }) => {
		const values = {
			name,
			description: description.trim() === '' ? null : description
		};

		let subject;
		if (id) {
			[subject] = await db
				.update(subjects)
				.set({ ...values, updatedAt: new Date() })
				.where(eq(subjects.id, id))
				.returning();
			if (!subject) {
				error(404, 'Subject not found');
			}
		} else {
			[subject] = await db.insert(subjects).values(values).returning();
		}

		await getSubjects().refresh();
		if (id) {
			await getSubjectById(id).refresh();
		}
		return subject;
	}
);
