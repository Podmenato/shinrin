import type { Tool, ToolDefinition } from './tool';
import { ToolError } from './tool';
import { db } from '../db/index';
import { mistakeObservations } from '../db/schema';
import { eq } from 'drizzle-orm';
import { toJsonObjectSchema, type JsonValue } from '#lib/json.js';

export class UpdateMistakeTool implements Tool {
	definition: ToolDefinition;

	constructor() {
		this.definition = {
			name: 'update_mistake',
			description:
				'Add a follow-up note to an existing mistake observation, identified by its id — appended with a timestamp, not merged or rewritten.',
			parameters: toJsonObjectSchema({
				id: { type: 'string', description: 'The id of the existing mistake to update.' },
				text: {
					type: 'string',
					description: 'Note to append — new context, a recurrence, a correction, etc.'
				}
			})
		};
	}

	async execute(args: Record<string, JsonValue>): Promise<string> {
		const id = args.id as string;
		const text = args.text as string;

		const [existing] = await db
			.select()
			.from(mistakeObservations)
			.where(eq(mistakeObservations.id, id));

		if (!existing) {
			throw new ToolError(`No mistake found with id "${id}".`);
		}

		const entry = `[${new Date().toISOString()}] ${text}`;
		const note = `${existing.note}\n${entry}`;

		await db.update(mistakeObservations).set({ note }).where(eq(mistakeObservations.id, id));

		return `Mistake updated: "${existing.title}"`;
	}
}
