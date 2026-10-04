import { Mistral } from '@mistralai/mistralai';
import { MistralError } from '@mistralai/mistralai/models/errors';
import type * as components from '@mistralai/mistralai/models/components';
import * as v from 'valibot';
import {
	ModelProviderError,
	type ModelProvider,
	type ModelResponse,
	type ModelToolCall
} from './modelProvider';
import type { Message, ToolCall } from '../contextManager';
import type { Tool } from '../tools/tool';
import type { JsonValue } from '#lib/json.js';
import { logger } from '../logger';
import { mistralApiKey } from '../env';
import { getProviderConfig } from '../db/providerSettings';

export const mistralSettingsSchema = v.object({
	maxTokens: v.pipe(v.number(), v.integer(), v.minValue(1)),
	// Unset = the model's own default, which varies per model (the API's documented range is 0–1.5).
	temperature: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1.5)))
});
export type MistralSettings = v.InferOutput<typeof mistralSettingsSchema>;
export const DEFAULT_MISTRAL_SETTINGS: MistralSettings = { maxTokens: 16000 };

type MistralMessage = components.ChatCompletionStreamRequestMessage;
type MistralTool = components.Tool & { type: 'function' };

function toProviderError(err: unknown): ModelProviderError {
	if (err instanceof MistralError) {
		if (err.statusCode === 401) {
			return new ModelProviderError(
				'Mistral rejected the API key. Check the MISTRAL_API_KEY environment variable.',
				{ cause: err }
			);
		}
		if (err.statusCode === 429) {
			return new ModelProviderError(
				'Mistral rate limit or spending limit reached — see API › Limits and the workspace ' +
					'spending limit in the Mistral console.',
				{ cause: err }
			);
		}
		return new ModelProviderError(`Mistral API error (${err.statusCode}): ${err.message}`, {
			cause: err
		});
	}
	return new ModelProviderError(err instanceof Error ? err.message : String(err), { cause: err });
}

// Read per call, not held on the instance — same reason as AnthropicProvider's getClient().
function getClient(): Mistral | null {
	const apiKey = mistralApiKey();
	return apiKey ? new Mistral({ apiKey }) : null;
}

function toMistralTool(tool: Tool): MistralTool {
	return {
		type: 'function',
		function: {
			name: tool.definition.name,
			description: tool.definition.description,
			parameters: tool.definition.parameters
		}
	};
}

const MISTRAL_TOOL_CALL_ID = /^[a-zA-Z0-9]{9}$/;

/**
 * The id Mistral sees for a call. Older Mistral tokenizers (v3–v11) reject any tool-call id that
 * isn't exactly 9 alphanumeric characters (mistral-common's request validator) — which our uuids
 * and Anthropic's `toolu_…` ids aren't. So: Mistral's own id when it produced the call, otherwise
 * the first 9 hex characters of our uuid — deterministic, so a replayed turn renders the same
 * every time.
 */
export function mistralToolCallId(toolCall: ToolCall): string {
	if (toolCall.providerCallId && MISTRAL_TOOL_CALL_ID.test(toolCall.providerCallId)) {
		return toolCall.providerCallId;
	}
	return toolCall.id.replaceAll('-', '').slice(0, 9);
}

/**
 * Bridges this app's Message[] history to Mistral's message format. Pure, like
 * toAnthropicRequest, and for the same reason: the history-shape rules are the risky part. The
 * rules below come from mistral-common's request validator:
 * - a system message may only follow system/user — so only leading system messages stay
 *   `system`; a mid-history one (agent.ts's "Provided no response… Retry." nudge, which can follow
 *   a tool result) becomes `user`;
 * - every tool call needs exactly one result, matched by id — unanswered calls (a run cancelled
 *   between tool calls) get a synthesized error result, and results with no matching call are
 *   dropped.
 */
export function toMistralRequest(messages: Message[]): MistralMessage[] {
	const result: MistralMessage[] = [];
	let i = 0;

	while (i < messages.length && messages[i].role === 'system') {
		if (messages[i].content.trim() !== '') {
			result.push({ role: 'system', content: messages[i].content });
		}
		i++;
	}

	// Leading orphan tool results — see toAnthropicRequest.
	while (i < messages.length && messages[i].role === 'tool') {
		i++;
	}

	while (i < messages.length) {
		const message = messages[i];

		if (message.role === 'user' || message.role === 'system') {
			result.push({ role: 'user', content: message.content });
			i++;
			continue;
		}

		if (message.role === 'assistant') {
			const toolCalls = message.toolCalls ?? [];
			result.push({
				role: 'assistant',
				content: message.content === '' ? null : message.content,
				toolCalls:
					toolCalls.length > 0
						? toolCalls.map((toolCall) => ({
								id: mistralToolCallId(toolCall),
								type: 'function',
								function: { name: toolCall.name, arguments: JSON.stringify(toolCall.args) }
							}))
						: undefined
			});
			i++;

			if (toolCalls.length === 0) {
				continue;
			}

			const resultsByCallId = new Map<string, string>();
			while (i < messages.length && messages[i].role === 'tool') {
				const toolMessage = messages[i];
				if (toolMessage.toolCallId !== undefined) {
					resultsByCallId.set(toolMessage.toolCallId, toolMessage.content);
				}
				i++;
			}

			for (const toolCall of toolCalls) {
				result.push({
					role: 'tool',
					toolCallId: mistralToolCallId(toolCall),
					name: toolCall.name,
					content: resultsByCallId.get(toolCall.id) ?? 'Cancelled.'
				});
			}
			continue;
		}

		// role === 'tool' after an assistant turn with no tool calls — see toAnthropicRequest.
		i++;
	}

	return result;
}

/** Only the text of a message's content — thinking chunks (reasoning models) are left out. */
function textOf(content: string | components.ContentChunk[] | null | undefined): string {
	if (typeof content === 'string') {
		return content;
	}
	return (content ?? [])
		.map((chunk) => (chunk.type === 'text' && 'text' in chunk ? chunk.text : ''))
		.join('');
}

/**
 * Mistral sends arguments as a JSON string (or, per its spec, sometimes an already-parsed object).
 * Its docs don't say what to do with a string that doesn't parse — such a call is flagged rather
 * than run with made-up arguments; see ModelToolCall.invalidArguments.
 */
export function parseToolArguments(
	raw: string | Record<string, unknown>
): Pick<ModelToolCall, 'args' | 'invalidArguments'> {
	if (typeof raw !== 'string') {
		return { args: raw as Record<string, JsonValue> };
	}
	if (raw.trim() === '') {
		return { args: {} };
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return { args: parsed as Record<string, JsonValue> };
		}
	} catch {
		// fall through
	}
	return { args: {}, invalidArguments: true };
}

type PendingToolCall = { id?: string; name: string; args: string | Record<string, unknown> };

export class MistralProvider implements ModelProvider {
	/** Chat models that support tool calling (agents always send tools) — `[]` with no key set. */
	async listModels(): Promise<string[]> {
		const client = getClient();
		if (!client) {
			return [];
		}

		const { data = [] } = await client.models.list();
		// One flatMap rather than filter + map: the `'capabilities' in model` check is what narrows
		// away the SDK's Unknown card type (which has no `id`), and that narrowing doesn't carry
		// from a plain filter callback over to the next map.
		return data.flatMap((model) =>
			'capabilities' in model &&
			model.capabilities.completionChat &&
			model.capabilities.functionCalling
				? [model.id]
				: []
		);
	}

	// Delegates to chatStream and drains it — see AnthropicProvider.chat.
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
			throw new ModelProviderError(
				'Mistral is not configured. Set the MISTRAL_API_KEY environment variable.'
			);
		}

		const { maxTokens, temperature } = await getProviderConfig(
			'mistral',
			mistralSettingsSchema,
			DEFAULT_MISTRAL_SETTINGS
		);
		const mistralMessages = toMistralRequest(messages);

		logger.debug({ model, messageCount: mistralMessages.length }, 'sending mistral request');
		logger.trace({ messages: mistralMessages }, 'context');

		let content = '';
		let responseModel: string | undefined;
		let finishReason: string | undefined;
		// Tool calls can arrive split across stream chunks, keyed by `index`: the first chunk for an
		// index carries the id and name, later ones append more of the arguments string.
		const pending = new Map<number, PendingToolCall>();

		try {
			const stream = await client.chat.stream(
				{
					model,
					messages: mistralMessages,
					tools: tools.length > 0 ? tools.map(toMistralTool) : undefined,
					maxTokens,
					temperature
				},
				{ signal }
			);

			for await (const event of stream) {
				const chunk = event.data;
				responseModel ??= chunk.model;
				const choice = chunk.choices[0];
				if (!choice) {
					continue;
				}

				const text = textOf(choice.delta.content);
				if (text) {
					content += text;
					yield text;
				}

				for (const [position, delta] of (choice.delta.toolCalls ?? []).entries()) {
					const index = delta.index ?? position;
					const existing = pending.get(index);
					if (!existing) {
						pending.set(index, {
							id: delta.id,
							name: delta.function.name,
							args: delta.function.arguments
						});
					} else if (
						typeof existing.args === 'string' &&
						typeof delta.function.arguments === 'string'
					) {
						existing.args += delta.function.arguments;
					} else {
						existing.args = delta.function.arguments;
					}
				}

				if (choice.finishReason) {
					finishReason = choice.finishReason;
				}
			}
		} catch (err) {
			throw toProviderError(err);
		}

		if (finishReason === 'error') {
			throw new ModelProviderError('Mistral reported an error while generating the reply.');
		}

		const toolCalls: ModelToolCall[] = [...pending.entries()]
			.sort(([a], [b]) => a - b)
			.map(([, call]) => ({
				providerCallId: call.id,
				name: call.name,
				...parseToolArguments(call.args)
			}));
		logger.debug({ finishReason, toolCalls: toolCalls.length }, 'received mistral reply');

		return {
			content,
			toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
			model: responseModel ?? model,
			// `model_length`: the model's own context limit — the reply was cut off either way.
			truncated: finishReason === 'length' || finishReason === 'model_length'
		};
	}
}
