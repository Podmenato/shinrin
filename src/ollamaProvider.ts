import { Ollama, Tool as OllamaTool } from "ollama";
import { ModelProvider } from "./modelProvider";
import { Message } from "./contextManager";
import { Tool } from "./tool";

const OLLAMA_LOCAL_URL = "http://localhost:11434";

function toOllamaTool(tool: Tool): OllamaTool {
    return {
        type: "function",
        function: {
            name: tool.definition.name,
            description: tool.definition.description,
            parameters: {
                type: "object",
                properties: Object.fromEntries(
                    tool.definition.parameters.map((param) => [
                        param,
                        { type: "string" },
                    ]),
                ),
            },
        },
    };
}

export class OllamaProvider implements ModelProvider {
    private ollama = new Ollama({ host: OLLAMA_LOCAL_URL });

    constructor(private model: string) {}

    async chat(messages: Message[], tools: Tool[]): Promise<string> {
        console.log(
            "MSG:",
            JSON.stringify({
                model: this.model,
                messages,
                tools: tools.map(toOllamaTool),
            }),
        );
        const response = await this.ollama.chat({
            model: this.model,
            messages,
            tools: tools.map(toOllamaTool),
        });

        console.log("RSP:", JSON.stringify(response));
        return response.message.content;
    }
}
