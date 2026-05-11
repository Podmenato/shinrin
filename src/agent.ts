import { ModelProvider } from "./modelProvider";

export async function runAgent(
    prompt: string,
    provider: ModelProvider,
): Promise<string> {
    return provider.chat(prompt);
}
