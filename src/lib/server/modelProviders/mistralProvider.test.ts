import { describe, it, expect } from 'vitest';
import { toMistralRequest, mistralToolCallId, parseToolArguments } from './mistralProvider';
import type { Message, ToolCall } from '../contextManager';

const call = (overrides: Partial<ToolCall> = {}): ToolCall => ({
	id: '3f2a9c1e-7b4d-4e8a-9c0f-1a2b3c4d5e6f',
	name: 'tool_a',
	args: {},
	...overrides
});

describe('mistralToolCallId', () => {
	it("keeps Mistral's own 9-character id", () => {
		expect(mistralToolCallId(call({ providerCallId: 'D681PevKs' }))).toBe('D681PevKs');
	});

	it('derives a stable 9-character id from our uuid otherwise', () => {
		expect(mistralToolCallId(call())).toBe('3f2a9c1e7');
		expect(mistralToolCallId(call({ providerCallId: 'toolu_01A09q90qw90lq917835lq9' }))).toBe(
			'3f2a9c1e7'
		);
	});
});

describe('toMistralRequest', () => {
	it('keeps leading system messages, skips empty ones, and maps a mid-history system message to user', () => {
		const messages: Message[] = [
			{ role: 'system', content: '' },
			{ role: 'system', content: 'You are a helper.' },
			{ role: 'user', content: 'Hi' },
			{ role: 'assistant', content: 'Hello!' },
			{ role: 'system', content: 'Provided no response, and called no tools. Retry.' },
			{ role: 'user', content: 'Try again' }
		];

		expect(toMistralRequest(messages)).toEqual([
			{ role: 'system', content: 'You are a helper.' },
			{ role: 'user', content: 'Hi' },
			{ role: 'assistant', content: 'Hello!', toolCalls: undefined },
			{ role: 'user', content: 'Provided no response, and called no tools. Retry.' },
			{ role: 'user', content: 'Try again' }
		]);
	});

	it('sends tool calls with content null and stringified arguments, and results in call order', () => {
		const a = call({ id: 'aaaaaaaa-0000-0000-0000-000000000000', name: 'tool_a', args: { x: 1 } });
		const b = call({ id: 'bbbbbbbb-0000-0000-0000-000000000000', name: 'tool_b', args: { y: 2 } });
		const messages: Message[] = [
			{ role: 'user', content: 'do two things' },
			{ role: 'assistant', content: '', toolCalls: [a, b] },
			// Saved out of call order, to show results are matched by id.
			{ role: 'tool', content: 'result b', toolName: 'tool_b', toolCallId: b.id },
			{ role: 'tool', content: 'result a', toolName: 'tool_a', toolCallId: a.id }
		];

		expect(toMistralRequest(messages)).toEqual([
			{ role: 'user', content: 'do two things' },
			{
				role: 'assistant',
				content: null,
				toolCalls: [
					{ id: 'aaaaaaaa0', type: 'function', function: { name: 'tool_a', arguments: '{"x":1}' } },
					{ id: 'bbbbbbbb0', type: 'function', function: { name: 'tool_b', arguments: '{"y":2}' } }
				]
			},
			{ role: 'tool', toolCallId: 'aaaaaaaa0', name: 'tool_a', content: 'result a' },
			{ role: 'tool', toolCallId: 'bbbbbbbb0', name: 'tool_b', content: 'result b' }
		]);
	});

	it('synthesizes a result for a call a cancelled run never answered', () => {
		const a = call({ id: 'aaaaaaaa-0000-0000-0000-000000000000' });
		const b = call({ id: 'bbbbbbbb-0000-0000-0000-000000000000' });
		const messages: Message[] = [
			{ role: 'user', content: 'go' },
			{ role: 'assistant', content: '', toolCalls: [a, b] },
			{ role: 'tool', content: 'result a', toolName: 'tool_a', toolCallId: a.id },
			{ role: 'assistant', content: 'Cancelled by user.' }
		];

		const out = toMistralRequest(messages);

		expect(out.slice(2)).toEqual([
			{ role: 'tool', toolCallId: 'aaaaaaaa0', name: 'tool_a', content: 'result a' },
			{ role: 'tool', toolCallId: 'bbbbbbbb0', name: 'tool_a', content: 'Cancelled.' },
			{ role: 'assistant', content: 'Cancelled by user.', toolCalls: undefined }
		]);
	});

	it('drops tool results with no matching call', () => {
		const a = call({ id: 'aaaaaaaa-0000-0000-0000-000000000000', name: 'save_memory' });
		const messages: Message[] = [
			{ role: 'tool', content: 'leading orphan', toolName: 'x' },
			{ role: 'user', content: 'go' },
			{ role: 'assistant', content: '', toolCalls: [a] },
			{ role: 'tool', content: 'pre-linking subagent reply', toolName: 'subagent_anki' },
			{ role: 'tool', content: 'saved', toolName: 'save_memory', toolCallId: a.id }
		];

		expect(toMistralRequest(messages).filter((m) => m.role === 'tool')).toEqual([
			{ role: 'tool', toolCallId: 'aaaaaaaa0', name: 'save_memory', content: 'saved' }
		]);
	});
});

describe('parseToolArguments', () => {
	it('parses a JSON object string', () => {
		expect(parseToolArguments('{"word":"森"}')).toEqual({ args: { word: '森' } });
	});

	it('passes an already-parsed object through', () => {
		expect(parseToolArguments({ word: '森' })).toEqual({ args: { word: '森' } });
	});

	it('treats an empty string as no arguments', () => {
		expect(parseToolArguments('')).toEqual({ args: {} });
	});

	it('flags invalid JSON and non-object JSON instead of guessing', () => {
		expect(parseToolArguments('{"word": "森"')).toEqual({ args: {}, invalidArguments: true });
		expect(parseToolArguments('["森"]')).toEqual({ args: {}, invalidArguments: true });
	});
});
