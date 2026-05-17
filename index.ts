import * as readline from "readline";
import { Agent } from "./src/agent";
import { OllamaProvider } from "./src/providers/ollamaProvider";
import { ContextManager } from "./src/contextManager";
import { CurrentTimeTool } from "./src/tools/currentTimeTool";

const LLAMA = "llama3.2:3b";
const GEMMA = "gemma4:latest";

const agent = new Agent(
    new OllamaProvider(LLAMA),
    new ContextManager(
        "You are a helpful assistant. Only use tools when the user explicitly asks for information that requires them. Do not use tools for greetings or casual conversation.",
    ),
    [new CurrentTimeTool()],
);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) => new Promise<string>((resolve) => rl.question(q, resolve));

while (true) {
    const input = await ask("> ");
    const response = await agent.run(input);
    console.log(response);
}
