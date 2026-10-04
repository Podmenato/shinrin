import type { Message } from '../contextManager';
import type { Tool } from '../tools/tool';
import type { JsonValue } from '#lib/json.js';

/**
 * A provider request that failed in a way the user should see as-is (missing/rejected API key,
 * rate limit, an API error) — runAgent surfaces its message instead of a generic 500. One class
 * for every provider: each message already names its provider, and nothing handles one provider's
 * failures differently from another's.
 */
export class ModelProviderError extends Error {}

/** A tool call as a provider returns it — before Agent assigns it our own id (see ToolCall). */
export type ModelToolCall = {
	/** The provider's own id for this call, if it assigns one — see ToolCall.providerCallId. */
	providerCallId?: string;
	name: string;
	args: Record<string, JsonValue>;
	/**
	 * Set when the provider sent arguments that couldn't be parsed into an object (`args` is then
	 * `{}`). Agent doesn't run such a call — it answers it with an error result instead.
	 */
	invalidArguments?: true;
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
	/**
	 * Generation stopped because it hit the provider's output token limit, not because the model
	 * finished — so any tool call in this response may have incomplete arguments.
	 */
	truncated?: boolean;
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
