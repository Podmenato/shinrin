import type { Message, ToolCall } from '../contextManager';
import type { Tool } from '../tools/tool';

export type ModelResponse = {
	content: string;
	toolCalls?: ToolCall[];
};

export interface ModelProvider {
	chat(messages: Message[], tools: Tool[]): Promise<ModelResponse>;
}
