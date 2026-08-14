export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

export type JsonObjectSchema = {
	type: 'object';
	description?: string;
	properties?: Record<string, JsonSchema>;
	required?: string[];
};
export type JsonArraySchema = { type: 'array'; description?: string; items: JsonSchema };
export type JsonBooleanSchema = { type: 'boolean'; description?: string };
export type JsonNumberSchema = {
	type: 'number' | 'integer';
	description?: string;
	enum?: number[];
};
export type JsonStringSchema = { type: 'string'; description?: string; enum?: string[] };

export type JsonSchema =
	| JsonStringSchema
	| JsonNumberSchema
	| JsonBooleanSchema
	| JsonArraySchema
	| JsonObjectSchema;

export type JsonSchemaArgument = JsonSchema & { optional?: true };

export function toJsonObjectSchema(
	properties: Record<string, JsonSchemaArgument>
): JsonObjectSchema {
	const outputProperties: Record<string, JsonSchema> = {};
	const required: string[] = [];
	for (const [key, arg] of Object.entries(properties)) {
		const { optional, ...rest } = arg;
		outputProperties[key] = rest;
		if (!optional) required.push(key);
	}
	return { type: 'object', properties: outputProperties, required };
}
