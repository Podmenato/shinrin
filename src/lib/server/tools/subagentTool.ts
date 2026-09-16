import type { Tool, ToolDefinition } from './tool';
import { ToolError } from './tool';
import { Agent } from '../agent';
import { toJsonObjectSchema, type JsonValue } from '#lib/json.js';
import type { ModelSelection } from '#lib/models.js';

/** Wraps another agent as a tool: calling it runs a full nested agent loop and returns its final reply. */
export class SubagentTool implements Tool {
	definition: ToolDefinition;

	constructor(
		private subagentId: string,
		name: string,
		description: string,
		private selection: ModelSelection,
		private parentSessionId: string
	) {
		this.definition = {
			name,
			description,
			parameters: toJsonObjectSchema({
				input: { type: 'string', description: 'The request to hand off to this subagent.' }
			})
		};
	}

	async execute(args: Record<string, JsonValue>, signal: AbortSignal): Promise<string> {
		const input = args.input;
		if (typeof input !== 'string') {
			throw new ToolError('input must be a string');
		}

		const agent = await Agent.create(
			this.subagentId,
			this.definition.name,
			this.selection,
			this.parentSessionId
		);

		return agent.run(input, undefined, signal);
	}
}
