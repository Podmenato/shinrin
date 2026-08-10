import type { Message, ToolCall } from '../contextManager';
import type { Tool } from '../tools/tool';

export type ModelResponse = {
	content: string;
	toolCalls?: ToolCall[];
};

export interface ModelProvider {
	chat(messages: Message[], tools: Tool[]): Promise<ModelResponse>;

	/** Yields content deltas as they arrive, and returns the final aggregated response. */
	chatStream(messages: Message[], tools: Tool[]): AsyncGenerator<string, ModelResponse, void>;

	/** Aborts whatever request this provider instance currently has in flight, if any. */
	abort(): void;
}
