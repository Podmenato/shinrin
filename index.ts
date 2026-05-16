import { runAgent } from "./src/agent";
import { OllamaProvider } from "./src/ollamaProvider";
import { ContextManager } from "./src/contextManager";

const ctx = new ContextManager(
    "You are a helpful assistant. Only use tools when the user explicitly asks for information that requires them. Do not use tools for greetings or casual conversation.",
);
const LLAMA = "llama3.2:3b";
const GEMMA = "gemma4:latest";

const provider = new OllamaProvider(LLAMA);

const args = process.argv.slice(2);
const result = await runAgent(args.join(" "), provider, ctx);
console.log(result);
