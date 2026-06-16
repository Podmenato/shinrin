import { Ollama, type Message as OllamaMessage, type Tool as OllamaTool } from 'ollama';
import type { ModelProvider, ModelResponse } from './modelProvider';
import type { Message } from '../contextManager';
import type { Tool } from '../tools/tool';
import { logger } from '../logger';

const OLLAMA_LOCAL_URL = 'http://localhost:11434';

function toOllamaMessage(message: Message): OllamaMessage {
	return {
		role: message.role,
		content: message.content,
		tool_calls: message.toolCalls?.map((tc) => ({
			function: { name: tc.name, arguments: tc.args }
		})),
		tool_name: message.toolName
	};
}

function toOllamaTool(tool: Tool): OllamaTool {
	return {
		type: 'function',
		function: {
			name: tool.definition.name,
			description: tool.definition.description,
			parameters: {
				type: 'object',
				properties: Object.fromEntries(
					tool.definition.parameters.map((param) => [
						param.name,
						{
							type: param.type,
							...(param.description ? { description: param.description } : {}),
							...(param.items ? { items: param.items } : {})
						}
					])
				),
				required: tool.definition.parameters.filter((p) => p.required).map((p) => p.name)
			}
		}
	};
}

export class OllamaProvider implements ModelProvider {
	private ollama = new Ollama({ host: OLLAMA_LOCAL_URL });

	constructor(private model: string) {}

	async chat(messages: Message[], tools: Tool[]): Promise<ModelResponse> {
		logger.debug({ model: this.model, messageCount: messages.length }, 'sending chat request');
		logger.trace({ messages }, 'context');

		const response = await this.ollama.chat({
			model: this.model,
			messages: messages.map(toOllamaMessage),
			tools: tools.map(toOllamaTool)
		});

		logger.debug(
			{
				hasToolCalls: !!response.message.tool_calls?.length,
				promptTokens: response.prompt_eval_count,
				responseTokens: response.eval_count
			},
			'received chat response'
		);

		return {
			content: response.message.content,
			toolCalls: response.message.tool_calls?.map((tc) => ({
				name: tc.function.name,
				args: tc.function.arguments
			}))
		};
	}
}
