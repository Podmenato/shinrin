import type { Tool, ToolDefinition } from './tool';
import { ToolError } from './tool';
import { db } from '../db/index';
import { studyTopics } from '../db/schema';

const VALID_STATUSES = ['introduced', 'practicing', 'mastered'] as const;

export class CreateTopicTool implements Tool {
	definition: ToolDefinition;
	private subjectId: string | null;

	constructor(subjectId: string | null) {
		this.subjectId = subjectId;
		this.definition = {
			name: 'create_topic',
			description:
				'Start tracking a new topic (a grammar point, vocab set, etc.) for the user. ' +
				'Check the topics already listed in your context first — if one already covers this, use update_topic instead of creating a near-duplicate.',
			parameters: [
				{
					name: 'topic',
					type: 'string',
					required: true,
					description: "Short name of the topic (e.g. 'べき grammar', 'family vocab')."
				},
				{
					name: 'status',
					type: 'string',
					required: true,
					description: `One of: ${VALID_STATUSES.join(', ')}.`
				},
				{
					name: 'notes',
					type: 'string',
					required: false,
					description: 'Optional detail — what was covered, what to focus on next, etc.'
				}
			]
		};
	}

	async execute(args: Record<string, unknown>): Promise<string> {
		const topic = args.topic as string;
		const status = args.status as string;
		const notes = (args.notes as string | undefined) ?? null;

		if (!this.subjectId) {
			throw new ToolError('This agent has no subject, so it cannot create topics.');
		}

		if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
			throw new ToolError(`status must be one of: ${VALID_STATUSES.join(', ')}.`);
		}

		const [created] = await db
			.insert(studyTopics)
			.values({ subjectId: this.subjectId, topic, status, notes })
			.onConflictDoNothing()
			.returning();

		if (!created) {
			throw new ToolError(`Topic "${topic}" already exists — use update_topic instead.`);
		}

		return `Topic created: "${topic}" → ${status}`;
	}

	cancel(): Promise<string> {
		return Promise.resolve('ok');
	}
}
