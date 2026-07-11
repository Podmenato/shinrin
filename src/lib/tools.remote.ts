import { query } from '$app/server';
import { db } from '$lib/server/db';
import { tools } from '$lib/server/db/schema';

/** Returns all tools that can be assigned to an agent. */
export const getTools = query(async () => {
	return db.select().from(tools).orderBy(tools.name);
});
