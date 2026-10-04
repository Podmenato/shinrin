import { describe, it, expect } from 'vitest';
import { toAnthropicRequest } from './anthropicProvider';
import type { Message } from '../contextManager';

describe('toAnthropicRequest', () => {
	it('joins leading system messages into the system param, and maps a mid-history system message to user', () => {
		const messages: Message[] = [
			{ role: 'system', content: 'You are a helper.' },
			{ role: 'system', content: 'Summary: prior chat.' },
			{ role: 'user', content: 'Hi' },
			{ role: 'assistant', content: 'Hello!' },
			{ role: 'system', content: 'Provided no response, and called no tools. Retry.' },
			{ role: 'user', content: 'Try again' }
		];

		const { system, messages: out } = toAnthropicRequest(messages);

		expect(system).toBe('You are a helper.\n\nSummary: prior chat.');
		expect(out).toEqual([
			{ role: 'user', content: 'Hi' },
			{ role: 'assistant', content: [{ type: 'text', text: 'Hello!' }] },
			{ role: 'user', content: 'Provided no response, and called no tools. Retry.' },
			{ role: 'user', content: 'Try again' }
		]);
	});

	it('collapses parallel tool calls into one user message of tool_result blocks, in call order', () => {
		const messages: Message[] = [
			{ role: 'system', content: 'sys' },
			{ role: 'user', content: 'do two things' },
			{
				role: 'assistant',
				content: '',
				toolCalls: [
					{ id: 'call-a', name: 'tool_a', args: { x: 1 } },
					{ id: 'call-b', name: 'tool_b', args: { y: 2 } }
				]
			},
			// Saved out of call order, to show results are looked up by id, not position.
			{ role: 'tool', content: 'result b', toolName: 'tool_b', toolCallId: 'call-b' },
			{ role: 'tool', content: 'result a', toolName: 'tool_a', toolCallId: 'call-a' }
		];

		const { messages: out } = toAnthropicRequest(messages);

		expect(out[1]).toEqual({
			role: 'assistant',
			content: [
				{ type: 'tool_use', id: 'call-a', name: 'tool_a', input: { x: 1 } },
				{ type: 'tool_use', id: 'call-b', name: 'tool_b', input: { y: 2 } }
			]
		});
		expect(out[2]).toEqual({
			role: 'user',
			content: [
				{ type: 'tool_result', tool_use_id: 'call-a', content: 'result a' },
				{ type: 'tool_result', tool_use_id: 'call-b', content: 'result b' }
			]
		});
	});

	it("replays Anthropic's own tool_use id when the call has one", () => {
		const messages: Message[] = [
			{ role: 'system', content: 'sys' },
			{ role: 'user', content: 'go' },
			{
				role: 'assistant',
				content: '',
				toolCalls: [{ id: 'call-a', providerCallId: 'toolu_01ABC', name: 'tool_a', args: {} }]
			},
			{ role: 'tool', content: 'ok', toolName: 'tool_a', toolCallId: 'call-a' }
		];

		const { messages: out } = toAnthropicRequest(messages);

		expect(out[1]).toEqual({
			role: 'assistant',
			content: [{ type: 'tool_use', id: 'toolu_01ABC', name: 'tool_a', input: {} }]
		});
		expect(out[2]).toEqual({
			role: 'user',
			content: [{ type: 'tool_result', tool_use_id: 'toolu_01ABC', content: 'ok' }]
		});
	});

	it('synthesizes is_error tool_results for tool calls a cancelled run never answered', () => {
		const messages: Message[] = [
			{ role: 'system', content: 'sys' },
			{ role: 'user', content: 'do three things' },
			{
				role: 'assistant',
				content: '',
				toolCalls: [
					{ id: 'call-a', name: 'tool_a', args: {} },
					{ id: 'call-b', name: 'tool_b', args: {} },
					{ id: 'call-c', name: 'tool_c', args: {} }
				]
			},
			{ role: 'tool', content: 'result a', toolName: 'tool_a', toolCallId: 'call-a' },
			{ role: 'assistant', content: 'Cancelled by user.' }
		];

		const { messages: out } = toAnthropicRequest(messages);

		expect(out[2]).toEqual({
			role: 'user',
			content: [
				{ type: 'tool_result', tool_use_id: 'call-a', content: 'result a' },
				{ type: 'tool_result', tool_use_id: 'call-b', content: 'Cancelled.', is_error: true },
				{ type: 'tool_result', tool_use_id: 'call-c', content: 'Cancelled.', is_error: true }
			]
		});
		expect(out[3]).toEqual({
			role: 'assistant',
			content: [{ type: 'text', text: 'Cancelled by user.' }]
		});
	});

	it('echoes providerContent verbatim and pairs tool_results against its tool_use ids', () => {
		const providerBlocks = [
			{ type: 'thinking', thinking: '', signature: 'sig' },
			{ type: 'text', text: 'Let me check.' },
			{ type: 'tool_use', id: 'toolu_01ABC', name: 'tool_a', input: { x: 1 } }
		];
		const messages: Message[] = [
			{ role: 'system', content: 'sys' },
			{ role: 'user', content: 'go' },
			{
				role: 'assistant',
				content: 'Let me check.',
				toolCalls: [
					{ id: 'call-a', providerCallId: 'toolu_01ABC', name: 'tool_a', args: { x: 1 } }
				],
				providerContent: providerBlocks
			},
			{ role: 'tool', content: 'ok', toolName: 'tool_a', toolCallId: 'call-a' }
		];

		const { messages: out } = toAnthropicRequest(messages);

		expect(out[1]).toEqual({ role: 'assistant', content: providerBlocks });
		expect(out[2]).toEqual({
			role: 'user',
			content: [{ type: 'tool_result', tool_use_id: 'toolu_01ABC', content: 'ok' }]
		});
	});

	it('drops a result saved before linking, whose call was never persisted', () => {
		const messages: Message[] = [
			{ role: 'system', content: 'sys' },
			{ role: 'user', content: 'go' },
			// A pre-linking subagent call: the call itself was never saved, its result has no toolCallId.
			{
				role: 'assistant',
				content: '',
				toolCalls: [{ id: 'call-a', name: 'save_memory', args: {} }]
			},
			{ role: 'tool', content: 'subagent reply', toolName: 'subagent_grammar' },
			{ role: 'tool', content: 'saved', toolName: 'save_memory', toolCallId: 'call-a' },
			{ role: 'user', content: 'next' }
		];

		const { messages: out } = toAnthropicRequest(messages);

		expect(out.slice(1)).toEqual([
			{
				role: 'assistant',
				content: [{ type: 'tool_use', id: 'call-a', name: 'save_memory', input: {} }]
			},
			{
				role: 'user',
				content: [{ type: 'tool_result', tool_use_id: 'call-a', content: 'saved' }]
			},
			{ role: 'user', content: 'next' }
		]);
	});

	it('drops a leading orphan tool message', () => {
		const messages: Message[] = [
			{ role: 'system', content: 'sys' },
			{ role: 'tool', content: 'orphan', toolName: 'x' },
			{ role: 'user', content: 'hello' }
		];

		const { messages: out } = toAnthropicRequest(messages);

		expect(out).toEqual([{ role: 'user', content: 'hello' }]);
	});
});
