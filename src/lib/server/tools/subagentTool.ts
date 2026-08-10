import type { Tool, ToolDefinition } from './tool';
import { ToolError } from './tool';
import { Agent } from '../agent';
import { OllamaProvider } from '../modelProviders/ollamaProvider';

/** Wraps another agent as a tool: calling it runs a full nested agent loop and returns its final reply. */
export class SubagentTool implements Tool {
	definition: ToolDefinition;
	private agent: Agent | null = null;
	private controller: AbortController | null = null;

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

		this.controller = new AbortController();

		// TODO: needs provider as a agent attribute + provider registry
		const provider = new OllamaProvider(this.model);
		const agent = await Agent.create(
			this.subagentId,
			this.definition.name,
			this.model,
			provider,
			this.parentSessionId
		);

		if (this.controller.signal.aborted) {
			return 'Cancelled by user.';
		}

		this.agent = agent;
		try {
			return await agent.run(input);
		} finally {
			this.agent = null;
			this.controller = null;
		}
	}

	async cancel(): Promise<string> {
		this.controller?.abort();
		await this.agent?.cancel();
		return 'Cancelled by user.';
	}
}
