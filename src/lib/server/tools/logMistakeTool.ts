import type { Tool, ToolDefinition } from './tool';
import { db } from '../db/index';
import { mistakeObservations } from '../db/schema';

export class LogMistakeTool implements Tool {
	definition: ToolDefinition;
	private agentId: string;

	constructor(agentId: string) {
		this.agentId = agentId;
		this.definition = {
			name: 'log_mistake',
			description:
				'Record an observation of a mistake the user made. Just log what happened, in plain language — do not worry about whether a similar mistake was logged before, that gets consolidated separately later.',
			parameters: [
				{
					name: 'note',
					type: 'string',
					required: true,
					description:
						"Plain description of the mistake (e.g. 'confused は and が when marking the topic of a sentence with a contrastive nuance')."
				}
			]
		};
	}

	async execute(args: Record<string, unknown>): Promise<string> {
		const note = args.note as string;

		await db.insert(mistakeObservations).values({ agentId: this.agentId, note });

		return 'Mistake logged.';
	}

	cancel(): Promise<string> {
		return Promise.resolve('ok');
	}
}
