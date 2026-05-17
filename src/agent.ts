import { ModelProvider } from "./modelProvider";
import { ContextManager } from "./contextManager";
import { CurrentTimeTool } from "./currentTimeTool";
import { Tool } from "./tool";

const MAX_ITERATIONS = 5;

export class Agent {
    private provider: ModelProvider;
    private ctx: ContextManager;
    private tools: Tool[];

    constructor(
        provider: ModelProvider,
        ctx: ContextManager,
        tools: Tool[] = [],
    ) {
        this.provider = provider;
        this.ctx = ctx;
        this.tools = tools;
    }

    async run(prompt: string): Promise<string> {
        const tool = new CurrentTimeTool();
        this.ctx.add({ role: "user", content: prompt });

        let iterations = 0;

        while (iterations < MAX_ITERATIONS) {
            iterations++;

            const response = await this.provider.chat(this.ctx.build(), [tool]);
            if (response.content) {
                this.ctx.add({ role: "assistant", content: response.content });
            }

            if (response.toolCalls !== undefined) {
                for (const toolCall of response?.toolCalls ?? []) {
                    const tool = this.tools.find(
                        (t) => t.definition.name === toolCall.name,
                    );
                    if (tool) {
                        const result = await tool.execute(toolCall.args);
                        this.ctx.add({
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
}
