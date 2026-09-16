import type { Message, ToolCall } from '../contextManager';
import type { Tool } from '../tools/tool';

export type ModelResponse = {
	content: string;
	toolCalls?: ToolCall[];
	model?: string;
};

export interface ModelProvider {
	/** Every model name currently selectable under this provider. */
	listModels(): Promise<string[]>;

	chat(
		model: string,
		messages: Message[],
		tools: Tool[],
		signal: AbortSignal
	): Promise<ModelResponse>;

	/** Yields content deltas as they arrive, and returns the final aggregated response. */
	chatStream(
		model: string,
		messages: Message[],
		tools: Tool[],
		signal: AbortSignal
	): AsyncGenerator<string, ModelResponse, void>;
}
