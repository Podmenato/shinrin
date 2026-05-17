import { Tool, ToolDefinition } from "../tool";
import { ankiRequest } from "./ankiClient";

export class FindNotesTool implements Tool {
    definition: ToolDefinition = {
        name: "find_notes",
        description:
            "Search Anki notes using Anki search syntax. Returns matching note IDs — an empty array means no duplicates exist. Quote deck names that contain spaces: deck:\"My Deck\". Examples: 'deck:Japanese', 'deck:\"Japanese IT vocab\" field:食べる'.",
        parameters: ["query"],
    };

    async execute(args: Record<string, unknown>): Promise<string> {
        const ids = await ankiRequest<number[]>("findNotes", {
            query: args.query,
        });
        return JSON.stringify(ids);
    }

    cancel(): Promise<string> {
        return Promise.resolve("ok");
    }
}
