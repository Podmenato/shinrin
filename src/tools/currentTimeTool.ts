import { Tool, ToolDefinition } from "./tool";

export class CurrentTimeTool implements Tool {
    definition: ToolDefinition;

    constructor() {
        this.definition = {
            name: "current_time_tool",
            description: "Returns the current time in the ISO format",
            parameters: [],
        };
    }

    cancel(): Promise<string> {
        return Promise.resolve("ok");
    }

    execute(): Promise<string> {
        return Promise.resolve(new Date().toISOString());
    }
}
