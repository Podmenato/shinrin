import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { agents } from '$lib/server/db/schema';

/** Returns all agents. */
export async function GET() {
	const result = await db.select().from(agents);
	return json(result);
}
