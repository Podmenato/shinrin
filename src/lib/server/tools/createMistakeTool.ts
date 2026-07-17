import type { Tool, ToolDefinition } from './tool';
import { ToolError } from './tool';
import { db } from '../db/index';
import { mistakeObservations } from '../db/schema';

export class CreateMistakeTool implements Tool {
	definition: ToolDefinition;
	private subjectId: string | null;

	constructor(subjectId: string | null) {
		this.subjectId = subjectId;
		this.definition = {
			name: 'create_mistake',
			description:
				'Record an observation of a mistake the user made. Just log what happened, in plain language — do not worry about whether a similar mistake was logged before, that gets consolidated separately later.',
			parameters: [
				{
					name: 'title',
					type: 'string',
					required: true,
					description: "Short label for the mistake (e.g. 'は/が confusion')."
				},
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
		const title = args.title as string;
		const note = args.note as string;

		if (!this.subjectId) {
			throw new ToolError('This agent has no subject, so it cannot create mistakes.');
		}

		await db.insert(mistakeObservations).values({ subjectId: this.subjectId, title, note });

		return 'Mistake logged.';
	}

	cancel(): Promise<string> {
		return Promise.resolve('ok');
	}
}
