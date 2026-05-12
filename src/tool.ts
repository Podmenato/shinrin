export type ToolDefinition = {
    name: string;
    description: string;
    parameters: string[];
};

export interface Tool {
    definition: ToolDefinition;
    execute(args: Record<string, unknown>): Promise<string>;
    cancel(): Promise<string>;
}
