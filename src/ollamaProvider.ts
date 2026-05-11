import { ModelProvider } from "./modelProvider";
import { Ollama } from "ollama";

const MODEL = "llama3.2:3b";

export class OllamaProvider implements ModelProvider {
    private ollama = new Ollama({ host: "http://localhost:11434" });

    async chat(prompt: string): Promise<string> {
        const response = await this.ollama.chat({
            model: MODEL,
            messages: [{ role: "user", content: prompt }],
        });

        return response.message.content;
    }
}
