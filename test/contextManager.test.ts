import { describe, it, expect, beforeEach } from "vitest";
import { ContextManager } from "../src/contextManager";

describe("ContextManager", () => {
    let ctx: ContextManager;

    beforeEach(() => {
        ctx = new ContextManager("You are a helpful assistant.");
    });

    it("should include system prompt as first message", () => {
        const messages = ctx.build();
        expect(messages[0]).toEqual({
            role: "system",
            content: "You are a helpful assistant.",
        });
    });

    it("should add messages to history", () => {
        ctx.add({ role: "user", content: "Hello" });
        ctx.add({ role: "assistant", content: "Hi there" });

        const messages = ctx.build();
        expect(messages).toHaveLength(3);
        expect(messages[1]).toEqual({ role: "user", content: "Hello" });
        expect(messages[2]).toEqual({ role: "assistant", content: "Hi there" });
    });

    it("should clear history but keep system prompt", () => {
        ctx.add({ role: "user", content: "Hello" });
        ctx.clear();

        const messages = ctx.build();
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toBe("system");
    });

    it("should preserve message order", () => {
        ctx.add({ role: "user", content: "first" });
        ctx.add({ role: "assistant", content: "second" });
        ctx.add({ role: "tool", content: "third" });

        const messages = ctx.build();
        expect(messages[1].content).toBe("first");
        expect(messages[2].content).toBe("second");
        expect(messages[3].content).toBe("third");
    });
});
