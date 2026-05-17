import { Tool, ToolDefinition } from "../tool";
import { ankiRequest } from "./ankiClient";

export class GetModelsTool implements Tool {
    definition: ToolDefinition = {
        name: "get_note_types",
        description: "Returns all Anki note types (models) and their fields",
        parameters: [],
    };

    async execute(): Promise<string> {
        const modelNames = await ankiRequest<string[]>("modelNames");
        const modelWithFieldNames = await Promise.all(
            modelNames.map(async (modelName) => {
                const fieldNames = await ankiRequest<string[]>(
                    "modelFieldNames",
                    { modelName },
                );
                return [modelName, fieldNames] as [string, string[]];
            }),
        );
        return JSON.stringify(Object.fromEntries(modelWithFieldNames));
    }

    cancel(): Promise<string> {
        return Promise.resolve("ok");
    }
}
