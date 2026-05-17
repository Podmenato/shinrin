import { Agent } from "./src/agent";
import { OllamaProvider } from "./src/ollamaProvider";
import { ContextManager } from "./src/contextManager";
import { CurrentTimeTool } from "./src/currentTimeTool";

const LLAMA = "llama3.2:3b";
const GEMMA = "gemma4:latest";

const args = process.argv.slice(2);
const agent = new Agent(
    new OllamaProvider(LLAMA),
    new ContextManager(
        "You are a helpful assistant. Only use tools when the user explicitly asks for information that requires them. Do not use tools for greetings or casual conversation.",
    ),
    [new CurrentTimeTool()],
);
const result = await agent.run(args.join(" "));
console.log(result);
