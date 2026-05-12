import { runAgent } from "./src/agent";
import { OllamaProvider } from "./src/ollamaProvider";
import { ContextManager } from "./src/contextManager";

const ctx = new ContextManager("You are a helpful assistant.");
const provider = new OllamaProvider("llama3.2:3b");

const args = process.argv.slice(2);
const result = await runAgent(args.join(" "), provider, ctx);
console.log(result);
