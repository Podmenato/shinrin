export type ToolParameter = {
	name: string;
	type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
	required: boolean;
	description?: string;
	items?: { type: string };
};

export type ToolDefinition = {
	name: string;
	description: string;
	parameters: ToolParameter[];
};

export class ToolError extends Error {
	constructor(msg: string) {
		super(msg);
		Object.setPrototypeOf(this, ToolError.prototype);
	}
}

export interface Tool {
	definition: ToolDefinition;
	execute(args: Record<string, unknown>): Promise<string>;
	cancel(): Promise<string>;
}
