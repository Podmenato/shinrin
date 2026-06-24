import type { Tool, ToolDefinition } from './tool';
import { ToolError } from './tool';
import { db } from '../db/index';
import { studyTopics } from '../db/schema';

const VALID_STATUSES = ['introduced', 'practicing', 'mastered'] as const;

export class UpdateTopicProgressTool implements Tool {
	definition: ToolDefinition;
	private agentId: string;

	constructor(agentId: string) {
		this.agentId = agentId;
		this.definition = {
			name: 'update_topic_progress',
			description:
				'Record or update the learning status of a specific topic (a grammar point, vocab set, etc.) for the user. ' +
				'Check the topics already listed in your context before naming a new one — reuse an existing topic name if it covers the same thing rather than creating a near-duplicate.',
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

		if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
			throw new ToolError(`status must be one of: ${VALID_STATUSES.join(', ')}.`);
		}

		await db
			.insert(studyTopics)
			.values({ agentId: this.agentId, topic, status, notes })
			.onConflictDoUpdate({
				target: [studyTopics.agentId, studyTopics.topic],
				set: { status, notes, updatedAt: new Date() }
			});

		return `Topic progress updated: "${topic}" → ${status}`;
	}

	cancel(): Promise<string> {
		return Promise.resolve('ok');
	}
}
