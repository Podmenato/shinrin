import type { Tool, ToolDefinition } from './tool';
import { db } from '../db/index';
import { memories } from '../db/schema';

export class SaveMemoryTool implements Tool {
	definition: ToolDefinition;
	private agentId: number;

	constructor(agentId: number) {
		this.agentId = agentId;
		this.definition = {
			name: 'save_memory',
			description:
				'Persist a piece of information about the user under a short key. Use this to remember facts across sessions — learning progress, recurring errors, preferences, or anything worth recalling next time. Overwrites any existing value for the same key.',
			parameters: [
				{
					name: 'key',
					type: 'string',
					required: true,
					description:
						"Short identifier for the memory (e.g. 'grammar_focus', 'current_topic')."
				},
				{
					name: 'value',
					type: 'string',
					required: true,
					description: 'The content to store.'
				}
			]
		};
	}

	async execute(args: Record<string, unknown>): Promise<string> {
		const key = args.key as string;
		const value = args.value as string;

		await db
			.insert(memories)
			.values({ agentId: this.agentId, key, value })
			.onConflictDoUpdate({
				target: [memories.agentId, memories.key],
				set: { value, updatedAt: new Date() }
			});

		return `Memory saved: "${key}"`;
	}

	cancel(): Promise<string> {
		return Promise.resolve('ok');
	}
}
