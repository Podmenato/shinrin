import type { Message } from '../contextManager';
import type { Tool } from '../tools/tool';
import type { JsonValue } from '#lib/json.js';

/** A tool call as a provider returns it — before Agent assigns it our own id (see ToolCall). */
export type ModelToolCall = {
	/** The provider's own id for this call, if it assigns one — see ToolCall.providerCallId. */
	providerCallId?: string;
	name: string;
	args: Record<string, JsonValue>;
};

export type ModelResponse = {
	content: string;
	toolCalls?: ModelToolCall[];
	model?: string;
	/**
	 * The provider's own representation of this assistant turn — for AnthropicProvider, the
	 * response's raw content-block array (thinking blocks, real tool_use ids and all), needed to
	 * echo the turn back unchanged if a tool-use loop continues it. `unknown` because only the
	 * provider that produced it ever reads it back; OllamaProvider never sets this. See
	 * Message.providerContent for why this never gets persisted.
	 */
	providerContent?: unknown;
};

export interface ModelProvider {
	/** Every model name currently selectable under this provider. */
	listModels(): Promise<string[]>;

	chat(
		model: string,
		messages: Message[],
		tools: Tool[],
		signal: AbortSignal
	): Promise<ModelResponse>;

	/** Yields content deltas as they arrive, and returns the final aggregated response. */
	chatStream(
		model: string,
		messages: Message[],
		tools: Tool[],
		signal: AbortSignal
	): AsyncGenerator<string, ModelResponse, void>;
}
