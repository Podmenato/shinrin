import { Tool, ToolDefinition } from "../tool";
import { ankiRequest } from "./ankiClient";

export class AddNoteTool implements Tool {
    definition: ToolDefinition = {
        name: "add_note",
        description:
            "Add a note to Anki. 'fields' must be a JSON string of field name to value pairs matching the note type.",
        parameters: ["deckName", "modelName", "fields", "tags"],
    };

    async execute(args: Record<string, unknown>): Promise<string> {
        const fields = JSON.parse(args.fields as string);
        const tags = args.tags ? (args.tags as string).split(",").map((t) => t.trim()) : [];

        const noteId = await ankiRequest<number>("addNote", {
            note: {
                deckName: args.deckName,
                modelName: args.modelName,
                fields,
                tags,
                options: { allowDuplicate: false },
            },
        });

        return JSON.stringify({ noteId });
    }

    cancel(): Promise<string> {
        return Promise.resolve("ok");
    }
}
