import { Ollama, Tool as OllamaTool } from "ollama";
import { ModelProvider, ModelResponse } from "./modelProvider";
import { Message } from "../contextManager";
import { Tool } from "../tools/tool";
import { logger } from "../logger";

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

    async chat(messages: Message[], tools: Tool[]): Promise<ModelResponse> {
        logger.debug(
            { model: this.model, messageCount: messages.length },
            "sending chat request",
        );

        const response = await this.ollama.chat({
            model: this.model,
            messages,
            tools: tools.map(toOllamaTool),
        });

        logger.debug(
            { hasToolCalls: !!response.message.tool_calls?.length },
            "received chat response",
        );

        return {
            content: response.message.content,
            toolCalls: response.message.tool_calls?.map((tc) => ({
                name: tc.function.name,
                args: tc.function.arguments,
            })),
        };
    }
}
