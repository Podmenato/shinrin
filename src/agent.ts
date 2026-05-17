import { ModelProvider } from "./modelProvider";
import { ContextManager } from "./contextManager";
import { CurrentTimeTool } from "./currentTimeTool";
import { Tool } from "./tool";
import { logger } from "./logger";

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
        logger.info({ prompt }, "agent run started");

        let iterations = 0;

        while (iterations < MAX_ITERATIONS) {
            iterations++;
            logger.debug({ iteration: iterations }, "agent iteration");

            const response = await this.provider.chat(this.ctx.build(), [tool]);
            if (response.content) {
                this.ctx.add({ role: "assistant", content: response.content });
            }

            if (response.toolCalls !== undefined) {
                for (const toolCall of response?.toolCalls ?? []) {
                    logger.info({ tool: toolCall.name, args: toolCall.args }, "tool call");
                    const tool = this.tools.find(
                        (t) => t.definition.name === toolCall.name,
                    );
                    if (tool) {
                        const result = await tool.execute(toolCall.args);
                        logger.debug({ tool: toolCall.name, result }, "tool result");
                        this.ctx.add({
                            role: "tool",
                            content: `${toolCall.name}: ${result}`,
                        });
                    } else {
                        logger.warn({ tool: toolCall.name }, "tool not found");
                    }
                }
                continue;
            }

            logger.info("agent run completed");
            return response.content;
        }

        logger.warn({ maxIterations: MAX_ITERATIONS }, "max iterations reached");
        return "Maximum iterations reached without completing task";
    }
}
