import type { Tool, ToolDefinition } from './tool';
import { db } from '../db/index';
import { memories } from '../db/schema';
import { toJsonObjectSchema, type JsonValue } from '#lib/json.js';

export class SaveMemoryTool implements Tool {
	definition: ToolDefinition;
	private agentId: string;

	constructor(agentId: string) {
		this.agentId = agentId;
		this.definition = {
			name: 'save_memory',
			description:
				'Persist a piece of information about the user under a short key. Use this to remember stable facts and preferences across sessions. Overwrites any existing value for the same key — check the memories already listed in your context before picking a new key, and reuse an existing one if it covers the same thing.',
			parameters: toJsonObjectSchema({
				key: {
					type: 'string',
					description: "Short identifier for the memory (e.g. 'jlpt_level', 'teaching_style')."
				},
				value: { type: 'string', description: 'The content to store.' }
			})
		};
	}

	async execute(args: Record<string, JsonValue>): Promise<string> {
		const key = args.key as string;
		const value = args.value as string;

		await db
			.insert(memories)
			.values({ agentId: this.agentId, key, value })
			.onConflictDoUpdate({
				target: [memories.agentId, memories.key],
				set: { value, deletedAt: null, updatedAt: new Date() }
			});

		return `Memory saved: "${key}"`;
	}
}
