import { describe, it, expect, vi, beforeEach } from "vitest";
import { Agent } from "./agent";
import { ContextManager } from "./contextManager";
import { ModelProvider } from "./modelProvider";
import { Tool } from "./tool";

const mockProvider = (): ModelProvider => ({
    chat: vi.fn(),
});

const mockTool = (name: string): Tool => ({
    definition: {
        name,
        description: "A mock tool",
        parameters: [],
    },
    execute: vi.fn(),
    cancel: vi.fn(),
});

describe("Agent", () => {
    let provider: ModelProvider;
    let ctx: ContextManager;

    beforeEach(() => {
        provider = mockProvider();
        ctx = new ContextManager("You are a helpful assistant.");
    });

    it("should return model response when no tool calls", async () => {
        vi.mocked(provider.chat).mockResolvedValue({
            content: "Hello there!",
        });

        const agent = new Agent(provider, ctx, []);
        const result = await agent.run("Hello");

        expect(result).toBe("Hello there!");
    });

    it("should execute tool and loop back when tool call is returned", async () => {
        const tool = mockTool("current_time_tool");
        vi.mocked(tool.execute).mockResolvedValue("2026-01-01T00:00:00.000Z");

        vi.mocked(provider.chat)
            .mockResolvedValueOnce({
                content: "",
                toolCalls: [{ name: "current_time_tool", args: {} }],
            })
            .mockResolvedValueOnce({
                content: "The time is 2026-01-01T00:00:00.000Z",
            });

        const agent = new Agent(provider, ctx, [tool]);
        const result = await agent.run("What time is it?");

        expect(tool.execute).toHaveBeenCalledOnce();
        expect(provider.chat).toHaveBeenCalledTimes(2);
        expect(result).toBe("The time is 2026-01-01T00:00:00.000Z");
    });

    it("should return max iterations message when loop does not resolve", async () => {
        vi.mocked(provider.chat).mockResolvedValue({
            content: "",
            toolCalls: [{ name: "unknown_tool", args: {} }],
        });

        const agent = new Agent(provider, ctx, []);
        const result = await agent.run("Loop forever");

        expect(result).toBe(
            "Maximum iterations reached without completing task",
        );
    });
});
