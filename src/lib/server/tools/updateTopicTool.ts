import type { Tool, ToolDefinition } from './tool';
import { ToolError } from './tool';
import { db } from '../db/index';
import { studyTopics } from '../db/schema';
import { eq } from 'drizzle-orm';

export class UpdateTopicTool implements Tool {
	definition: ToolDefinition;

	constructor() {
		this.definition = {
			name: 'update_topic',
			description:
				'Add a note to an existing topic, identified by its id — appended with a timestamp, not merged or rewritten.',
			parameters: [
				{
					name: 'id',
					type: 'string',
					required: true,
					description: 'The id of the existing topic to update.'
				},
				{
					name: 'text',
					type: 'string',
					required: true,
					description: 'Note to append — what changed, what was covered, what to focus on next.'
				}
			]
		};
	}

	async execute(args: Record<string, unknown>): Promise<string> {
		const id = args.id as string;
		const text = args.text as string;

		const [existing] = await db.select().from(studyTopics).where(eq(studyTopics.id, id));

		if (!existing) {
			throw new ToolError(`No topic found with id "${id}".`);
		}

		const entry = `[${new Date().toISOString()}] ${text}`;
		const notes = existing.notes ? `${existing.notes}\n${entry}` : entry;

		await db
			.update(studyTopics)
			.set({ notes, updatedAt: new Date() })
			.where(eq(studyTopics.id, id));

		return `Topic updated: "${existing.topic}"`;
	}

	cancel(): Promise<string> {
		return Promise.resolve('ok');
	}
}
