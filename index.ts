import { runAgent } from "./src/agent";
import { OllamaProvider } from "./src/ollamaProvider";

const args = process.argv.slice(2);
const result = await runAgent(args.join(" "), new OllamaProvider("llama3.2:3b"));
console.log(result);
