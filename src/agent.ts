import { ModelProvider } from "./modelProvider";
import { ContextManager } from "./contextManager";
import { CurrentTimeTool } from "./currentTimeTool";

export async function runAgent(
    prompt: string,
    provider: ModelProvider,
    ctx: ContextManager,
): Promise<string> {
    const tool = new CurrentTimeTool();
    ctx.add({ role: "user", content: prompt });
    const response = await provider.chat(ctx.build(), [tool]);
    ctx.add({ role: "assistant", content: response });
    return response;
}
