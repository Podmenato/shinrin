import { runAgent } from "./src/agent";

const args = process.argv.slice(2);
const result = await runAgent(args.join(" "));
console.log(result);
