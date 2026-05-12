import { ModelProvider } from "./modelProvider";
import { ContextManager } from "./contextManager";

export async function runAgent(
    prompt: string,
    provider: ModelProvider,
    ctx: ContextManager,
): Promise<string> {
    ctx.add({ role: "user", content: prompt });
    const response = await provider.chat(ctx.build());
    ctx.add({ role: "assistant", content: response });
    return response;
}
