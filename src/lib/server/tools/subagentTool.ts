import type { Tool, ToolDefinition } from './tool';
import { ToolError } from './tool';
import { Agent } from '../agent';
import { OllamaProvider } from '../modelProviders/ollamaProvider';

/** Wraps another agent as a tool: calling it runs a full nested agent loop and returns its final reply. */
export class SubagentTool implements Tool {
	definition: ToolDefinition;

	constructor(
		private subagentId: string,
		name: string,
		description: string,
		private model: string
	) {
		this.definition = {
			name,
			description,
			parameters: [
				{
					name: 'input',
					type: 'string',
					required: true,
					description: 'The request to hand off to this subagent.'
				}
			]
		};
	}

	async execute(args: Record<string, unknown>): Promise<string> {
		const input = args.input;
		if (typeof input !== 'string') {
			throw new ToolError('input must be a string');
		}

		// TODO: needs provider as a agent attribute + provider registry
		const provider = new OllamaProvider(this.model);
		const agent = await Agent.create(this.subagentId, this.definition.name, this.model, provider);
		return agent.run(input);
	}

	cancel(): Promise<string> {
		return Promise.resolve('ok');
	}
}
