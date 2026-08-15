import { error } from '@sveltejs/kit';
import { readFileSync } from 'node:fs';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const [file] = await db.select().from(files).where(eq(files.id, params.fileId));
	if (!file) {
		error(404, 'File not found');
	}

	const contentType = file.mimeType.startsWith('text/')
		? `${file.mimeType}; charset=utf-8`
		: file.mimeType;

	return new Response(readFileSync(file.path), {
		headers: { 'Content-Type': contentType, 'Content-Disposition': 'inline' }
	});
};
