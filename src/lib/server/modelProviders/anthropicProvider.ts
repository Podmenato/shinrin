import Anthropic, { APIError, AuthenticationError, RateLimitError } from '@anthropic-ai/sdk';
import * as v from 'valibot';
import type { ModelProvider, ModelResponse } from './modelProvider';
import type { Message, ToolCall } from '../contextManager';
import type { Tool } from '../tools/tool';
import type { JsonValue } from '#lib/json.js';
import { logger } from '../logger';
import { anthropicApiKey } from '../env';
import { getProviderConfig } from '../db/providerSettings';

// `max_tokens` is a required Anthropic request parameter with no default, it's a cap on
// generation length, not a context-window reservation
export const anthropicSettingsSchema = v.object({
	maxTokens: v.pipe(v.number(), v.integer(), v.minValue(1))
});
export type AnthropicSettings = v.InferOutput<typeof anthropicSettingsSchema>;
export const DEFAULT_ANTHROPIC_SETTINGS: AnthropicSettings = { maxTokens: 16000 };

/** User-facing errors from a failed Anthropic request — mirrors tool.ts's ToolError. */
export class AnthropicProviderError extends Error {
	constructor(msg: string) {
		super(msg);
		Object.setPrototypeOf(this, AnthropicProviderError.prototype);
	}
}

function toProviderError(err: unknown): AnthropicProviderError {
	// Most specific first: AuthenticationError/RateLimitError are themselves APIErrors.
	if (err instanceof AuthenticationError) {
		return new AnthropicProviderError(
			'Anthropic rejected the API key. Check the ANTHROPIC_API_KEY environment variable.'
		);
	}
	if (err instanceof RateLimitError) {
		return new AnthropicProviderError('Anthropic rate limit reached — try again shortly.');
	}
	if (err instanceof APIError) {
		return new AnthropicProviderError(`Anthropic API error: ${err.message}`);
	}
	return new AnthropicProviderError(err instanceof Error ? err.message : String(err));
}

// The registry instantiates providers eagerly at module scope (see providerRegistry.ts), so the
// key can't live on a constructor-injected field — it's read fresh on every call instead, exactly
// like OllamaProvider reads its num_ctx setting per request rather than once at startup.
function getClient(): Anthropic | null {
	const apiKey = anthropicApiKey();
	return apiKey ? new Anthropic({ apiKey }) : null;
}

function toAnthropicTool(tool: Tool): Anthropic.Tool {
	return {
		name: tool.definition.name,
		description: tool.definition.description,
		// tool.definition.parameters is already a real JsonObjectSchema matching Anthropic's wire
		// format (see json.ts) — a one-line conversion, not a recursive reshape.
		input_schema: tool.definition.parameters as Anthropic.Tool['input_schema']
	};
}

/**
 * The id Anthropic sees for a call: its own `toolu_...` id if it produced the call, so a replayed
 * turn matches what the model actually emitted (and stays identical across runs, keeping the prompt
 * cache prefix stable), otherwise our own id — a uuid is a valid tool_use id.
 */
function toolUseId(toolCall: ToolCall): string {
	return toolCall.providerCallId ?? toolCall.id;
}

/**
 * Bridges this app's Ollama-shaped Message[] history to Anthropic's wire format. A pure function,
 * deliberately: it's the single riskiest piece of this provider (cancelled tool calls, parallel
 * tool calls, and mid-history system messages all have to round-trip correctly), and keeping it
 * pure keeps it testable without standing up the provider or a fake network call.
 */
export function toAnthropicRequest(messages: Message[]): {
	system: string | undefined;
	messages: Anthropic.MessageParam[];
} {
	let i = 0;

	// Leading system message(s) (the agent's own system prompt, optionally followed by a stored
	// summary — see ContextManager.build()) become the top-level `system` param. Anthropic does
	// have a native mid-conversation `system` role, but only on some models (accepted on Opus 5,
	// rejected with a 400 on Sonnet 5), and the model can change under a session — so a mid-history
	// system message (e.g. agent.ts's "Provided no response... Retry." nudge) is mapped to `user`
	// uniformly below instead, never conditionally.
	const systemParts: string[] = [];
	while (i < messages.length && messages[i].role === 'system') {
		if (messages[i].content.trim() !== '') {
			systemParts.push(messages[i].content);
		}
		i++;
	}
	const system = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;

	// A summary cutoff (ContextManager.compact(), not currently called from anywhere — see
	// contextManager.ts) could in principle leave history starting with a `tool` message, i.e. a
	// tool_result answering nothing. Drop any leading orphans rather than send an invalid request.
	while (i < messages.length && messages[i].role === 'tool') {
		i++;
	}

	const result: Anthropic.MessageParam[] = [];

	while (i < messages.length) {
		const message = messages[i];

		if (message.role === 'user' || message.role === 'system') {
			result.push({ role: 'user', content: message.content });
			i++;
			continue;
		}

		if (message.role === 'assistant') {
			const toolCalls = message.toolCalls ?? [];

			let content: Anthropic.ContentBlockParam[];
			if (message.providerContent !== undefined) {
				// Thinking is on by default on current Anthropic models, and the assistant turn being
				// continued in a tool-use loop must be echoed back with its content blocks unchanged —
				// reconstructing from `content` + `toolCalls` would lose the thinking blocks. Only ever
				// set on the in-memory turn just produced by *this* run (see Message.providerContent).
				// Its tool_use ids are the same providerCallIds `toolCalls` carries, since both came
				// from the same response.
				content = message.providerContent as Anthropic.ContentBlockParam[];
			} else {
				content = [
					// Anthropic rejects empty text blocks; an assistant message with tool calls often has
					// content: '' (it said nothing, just called tools), so only emit it when non-empty.
					...(message.content ? [{ type: 'text' as const, text: message.content }] : []),
					...toolCalls.map(
						(toolCall): Anthropic.ToolUseBlockParam => ({
							type: 'tool_use',
							id: toolUseId(toolCall),
							name: toolCall.name,
							input: toolCall.args
						})
					)
				];
			}

			result.push({ role: 'assistant', content });
			i++;

			if (toolCalls.length === 0) {
				continue;
			}

			const resultsByCallId = new Map<string, string>();
			while (i < messages.length && messages[i].role === 'tool') {
				const toolMessage = messages[i];
				// No toolCallId: a result saved before tool calls and results were linked, whose call
				// was never persisted (a subagent call) — there's nothing valid to attach it to.
				if (toolMessage.toolCallId !== undefined) {
					resultsByCallId.set(toolMessage.toolCallId, toolMessage.content);
				}
				i++;
			}

			// Anthropic requires every tool_result answering one assistant turn to arrive in a single
			// user message — splitting them across messages (one per agent.run()'s persisted `tool`
			// message) silently degrades the model's willingness to make parallel tool calls.
			//
			// A call left unanswered — a run cancelled between tool calls (agent.run()'s loop breaks on
			// signal.aborted before executing the rest) — gets a synthesized error result: replaying a
			// tool_use without a matching tool_result is a permanent 400, and that session could never
			// be continued again.
			const toolResults = toolCalls.map((toolCall): Anthropic.ToolResultBlockParam => {
				const resultContent = resultsByCallId.get(toolCall.id);
				return resultContent !== undefined
					? { type: 'tool_result', tool_use_id: toolUseId(toolCall), content: resultContent }
					: {
							type: 'tool_result',
							tool_use_id: toolUseId(toolCall),
							content: 'Cancelled.',
							is_error: true
						};
			});

			result.push({ role: 'user', content: toolResults });
			continue;
		}

		// role === 'tool' following an assistant turn with no tool calls (a pre-linking result whose
		// call was never persisted) — skip rather than emit an orphaned tool_result.
		i++;
	}

	return { system, messages: result };
}

function toModelResponse(message: Anthropic.Message, requestedModel: string): ModelResponse {
	// An HTTP 200, not an exception — has to be checked explicitly before reading `content`, since
	// a refusal can leave it empty. Surfaced as a normal assistant reply rather than a blank message.
	if (message.stop_reason === 'refusal') {
		return {
			content: message.stop_details?.explanation ?? 'Claude declined to respond to this request.',
			model: message.model ?? requestedModel,
			providerContent: message.content
		};
	}

	const content = message.content
		.filter((block): block is Anthropic.TextBlock => block.type === 'text')
		.map((block) => block.text)
		.join('');

	const toolCalls = message.content
		.filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
		.map((block) => ({
			providerCallId: block.id,
			name: block.name,
			args: block.input as Record<string, JsonValue>
		}));

	return {
		content,
		toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
		// Prefer the response's reported model over the requested one where they differ (e.g. an
		// alias resolving to a dated snapshot).
		model: message.model ?? requestedModel,
		providerContent: message.content
	};
}

export class AnthropicProvider implements ModelProvider {
	/** Every model Anthropic currently reports for this API key, live — `[]` with no key set. */
	async listModels(): Promise<string[]> {
		const client = getClient();
		if (!client) {
			return [];
		}

		const models: string[] = [];
		for await (const model of client.models.list()) {
			models.push(model.id);
		}
		return models;
	}

	// Delegates to chatStream and drains it: streaming is the supported path for a large
	// `max_tokens` request, not (as with Ollama) a workaround for how the client attaches its
	// abort controller.
	async chat(
		model: string,
		messages: Message[],
		tools: Tool[],
		signal: AbortSignal
	): Promise<ModelResponse> {
		const stream = this.chatStream(model, messages, tools, signal);
		let next = await stream.next();
		while (!next.done) {
			next = await stream.next();
		}
		return next.value;
	}

	async *chatStream(
		model: string,
		messages: Message[],
		tools: Tool[],
		signal: AbortSignal
	): AsyncGenerator<string, ModelResponse, void> {
		const client = getClient();
		if (!client) {
			throw new AnthropicProviderError(
				'Anthropic is not configured. Set the ANTHROPIC_API_KEY environment variable.'
			);
		}

		const { maxTokens } = await getProviderConfig(
			'anthropic',
			anthropicSettingsSchema,
			DEFAULT_ANTHROPIC_SETTINGS
		);
		const { system, messages: anthropicMessages } = toAnthropicRequest(messages);

		logger.debug({ model, messageCount: anthropicMessages.length }, 'sending anthropic request');
		logger.trace({ system, messages: anthropicMessages }, 'context');

		try {
			const stream = client.messages.stream(
				{
					model,
					max_tokens: maxTokens,
					system,
					messages: anthropicMessages,
					tools: tools.map(toAnthropicTool)
				},
				{ signal }
			);

			// Iterate the raw stream events rather than the `.on('text', ...)` callback API — the
			// callback shape doesn't fit an async generator, and hand-reassembling partial tool-input
			// JSON from input_json_delta events is exactly what finalMessage() already does for us.
			// Thinking is deliberately never streamed into the reply text — the chat UI's "Thinking…"
			// spinner already covers this gap correctly, and mixing reasoning into the message body
			// would corrupt the persisted `content`.
			for await (const event of stream) {
				if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
					yield event.delta.text;
				}
			}

			const message = await stream.finalMessage();
			const hasToolCalls = message.content.some((block) => block.type === 'tool_use');
			logger.debug({ stopReason: message.stop_reason, hasToolCalls }, 'received anthropic reply');

			return toModelResponse(message, model);
		} catch (err) {
			throw toProviderError(err);
		}
	}
}
