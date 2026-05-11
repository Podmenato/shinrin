import { runAgent } from "./src/agent";
import { OllamaProvider } from "./src/ollamaProvider";

const args = process.argv.slice(2);
const result = await runAgent(args.join(" "), new OllamaProvider());
console.log(result);
