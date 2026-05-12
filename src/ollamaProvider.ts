import { Ollama } from "ollama";
import { ModelProvider } from "./modelProvider";
import { Message } from "./contextManager";

const OLLAMA_LOCAL_URL = "http://localhost:11434";

export class OllamaProvider implements ModelProvider {
    private ollama = new Ollama({ host: OLLAMA_LOCAL_URL });

    constructor(private model: string) {}

    async chat(messages: Message[]): Promise<string> {
        const response = await this.ollama.chat({
            model: this.model,
            messages,
        });

        return response.message.content;
    }
}
