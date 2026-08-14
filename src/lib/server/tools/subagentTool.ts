import type { Tool, ToolDefinition } from './tool';
import { ToolError } from './tool';
import { Agent } from '../agent';
import { OllamaProvider } from '../modelProviders/ollamaProvider';
import { toJsonObjectSchema, type JsonValue } from '$lib/json';

/** Wraps another agent as a tool: calling it runs a full nested agent loop and returns its final reply. */
export class SubagentTool implements Tool {
	definition: ToolDefinition;

	constructor(
		private subagentId: string,
		name: string,
		description: string,
		private model: string,
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

		// TODO: needs provider as a agent attribute + provider registry
		const provider = new OllamaProvider(this.model);
		const agent = await Agent.create(
			this.subagentId,
			this.definition.name,
			this.model,
			provider,
			this.parentSessionId
		);

		return agent.run(input, undefined, signal);
	}
}
