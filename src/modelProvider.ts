import { Message } from "./contextManager";
import { Tool } from "./tool";

export interface ModelProvider {
    chat(messages: Message[], tools: Tool[]): Promise<string>;
}
