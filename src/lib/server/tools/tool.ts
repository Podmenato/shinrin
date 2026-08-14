import type { JsonValue, JsonObjectSchema } from '$lib/json';

export type ToolDefinition = {
	name: string;
	description: string;
	parameters: JsonObjectSchema;
};

export class ToolError extends Error {
	constructor(msg: string) {
		super(msg);
		Object.setPrototypeOf(this, ToolError.prototype);
	}
}

export interface Tool {
	definition: ToolDefinition;
	execute(args: Record<string, JsonValue>, signal: AbortSignal): Promise<string>;
}
