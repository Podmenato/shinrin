import { ModelProvider } from "./modelProvider";
import { ContextManager } from "./contextManager";
import { CurrentTimeTool } from "./currentTimeTool";

const MAX_ITERATIONS = 5;

export async function runAgent(
    prompt: string,
    provider: ModelProvider,
    ctx: ContextManager,
): Promise<string> {
    const tool = new CurrentTimeTool();
    ctx.add({ role: "user", content: prompt });

    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
        iterations++;

        const response = await provider.chat(ctx.build(), [tool]);
        if (response.content) {
            ctx.add({ role: "assistant", content: response.content });
        }

        if (response.toolCalls !== undefined) {
            for (const toolCall of response?.toolCalls ?? []) {
                if (toolCall.name === "current_time_tool") {
                    const result = await tool.execute();
                    ctx.add({
                        role: "tool",
                        content: `${toolCall.name}: ${result}`,
                    });
                }
            }
            continue;
        }

        return response.content;
    }

    return "Maximum iterations reached without completing task";
}
