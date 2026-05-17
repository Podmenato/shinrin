import { Tool, ToolDefinition } from "../tool";
import { ankiRequest } from "./ankiClient";

type NoteField = { value: string; order: number };

type NoteInfo = {
    noteId: number;
    modelName: string;
    fields: Record<string, NoteField>;
    tags: string[];
};

export class GetNoteInfoTool implements Tool {
    definition: ToolDefinition = {
        name: "get_note_info",
        description:
            "Returns full note data (fields, tags, model) for a list of note IDs. Pass a JSON array of IDs from find_notes, e.g. '[123, 456]'. Use this on a small, targeted set of IDs — not on large find_notes results.",
        parameters: ["noteIds"],
    };

    async execute(args: Record<string, unknown>): Promise<string> {
        const noteIds = JSON.parse(args.noteIds as string) as number[];
        const notes = await ankiRequest<NoteInfo[]>("notesInfo", {
            notes: noteIds,
        });
        return JSON.stringify(notes);
    }

    cancel(): Promise<string> {
        return Promise.resolve("ok");
    }
}
