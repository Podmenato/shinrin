import type { Tool, ToolDefinition } from './tool';
import { ToolError } from './tool';
import { db } from '../db/index';
import { memories } from '../db/schema';
import { and, eq, isNull } from 'drizzle-orm';

export class DeleteMemoryTool implements Tool {
	definition: ToolDefinition;
	private agentId: string;

	constructor(agentId: string) {
		this.agentId = agentId;
		this.definition = {
			name: 'delete_memory',
			description:
				'Remove a previously saved memory by key. Use this to retire a memory that is no longer relevant or accurate, rather than leaving stale information in place.',
			parameters: [
				{
					name: 'key',
					type: 'string',
					required: true,
					description: 'The key of the memory to delete.'
				}
			]
		};
	}

	async execute(args: Record<string, unknown>): Promise<string> {
		const key = args.key as string;

		const [deleted] = await db
			.update(memories)
			.set({ deletedAt: new Date() })
			.where(
				and(eq(memories.agentId, this.agentId), eq(memories.key, key), isNull(memories.deletedAt))
			)
			.returning();

		if (!deleted) {
			throw new ToolError(`No memory found with key "${key}".`);
		}

		return `Memory deleted: "${key}"`;
	}

	cancel(): Promise<string> {
		return Promise.resolve('ok');
	}
}
