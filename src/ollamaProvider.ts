import { ModelProvider } from "./modelProvider";
import { Ollama } from "ollama";

const OLLAMA_LOCAL_URL = "http://localhost:11434";

export class OllamaProvider implements ModelProvider {
    private ollama = new Ollama({ host: OLLAMA_LOCAL_URL });

    constructor(private model: string) {}

    async chat(prompt: string): Promise<string> {
        const response = await this.ollama.chat({
            model: this.model,
            messages: [{ role: "user", content: prompt }],
        });

        return response.message.content;
    }
}
