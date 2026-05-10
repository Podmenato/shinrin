import {runAgent} from "./agent";

const args = process.argv.slice(2);

const result = runAgent(args.join(" "))
console.log(result);
