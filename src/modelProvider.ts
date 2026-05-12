import { Message } from "./contextManager";

export interface ModelProvider {
    chat(messages: Message[]): Promise<string>;
}
