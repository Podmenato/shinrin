import { Message } from "../contextManager";
import { Tool } from "../tools/tool";

export type ToolCall = {
    name: string;
    args: Record<string, string>;
};

export type ModelResponse = {
    content: string;
    toolCalls?: ToolCall[];
};

export interface ModelProvider {
    chat(messages: Message[], tools: Tool[]): Promise<ModelResponse>;
}
