import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { Agent } from './agent';
import { ContextManager } from './contextManager';
import { FakeModelProvider } from './modelProviders/fakeModelProvider';
import { db } from './db/index';
import { agents, sessions, tools as toolsTable, messages, messageToolCalls } from './db/schema';
import type { Tool } from './tools/tool';
import { ToolError } from './tools/tool';
import { toJsonObjectSchema } from '$lib/json';

async function seedSession() {
	const [agent] = await db.insert(agents).values({ name: 'agent' }).returning();
	const [session] = await db
		.insert(sessions)
		.values({ agentId: agent.id, name: 'session', model: 'test-model' })
		.returning();
	return session;
}

function fakeTool(name: string, execute: Tool['execute']): Tool {
	return {
		definition: { name, description: name, parameters: toJsonObjectSchema({}) },
		execute
	};
}

// `db` is a shared ':memory:' instance for the whole test file (not recreated per test), so
// every test's rows need clearing out afterward to avoid unique-constraint collisions (e.g.
// agents.name/tools.name) and cross-test bleed.
afterEach(async () => {
	await db.delete(messageToolCalls);
	await db.delete(messages);
	await db.delete(sessions);
	await db.delete(agents);
	await db.delete(toolsTable);
});

describe('Agent.run', () => {
	it('returns the model final content when no tool calls are made', async () => {
		const session = await seedSession();
		const ctx = new ContextManager('system prompt', session.id);
		const provider = new FakeModelProvider([{ content: 'hello there' }]);
		const agent = new Agent(session.agentId, provider, ctx, []);

		const result = await agent.run('hi', undefined, new AbortController().signal);

		expect(result).toBe('hello there');
		const persisted = await db.query.messages.findMany({
			where: eq(messages.sessionId, session.id)
		});
		expect(persisted.map((m) => m.role)).toEqual(['user', 'assistant']);
	});

	it('executes a requested tool call and feeds the result back to the model', async () => {
		const session = await seedSession();
		await db.insert(toolsTable).values({ name: 'echo' });
		const ctx = new ContextManager('system prompt', session.id);
		const echo = fakeTool('echo', async (args) => `echoed: ${args.text}`);
		const provider = new FakeModelProvider([
			{ content: '', toolCalls: [{ name: 'echo', args: { text: 'hi' } }] },
			{ content: 'done' }
		]);
		const agent = new Agent(session.agentId, provider, ctx, [echo]);

		const result = await agent.run('please echo', undefined, new AbortController().signal);

		expect(result).toBe('done');
		expect(provider.calls).toHaveLength(2);
		const toolMessage = provider.calls[1].messages.find((m) => m.role === 'tool');
		expect(toolMessage?.content).toBe('echoed: hi');

		const toolCallRows = await db.query.messageToolCalls.findMany({ with: { tool: true } });
		expect(toolCallRows).toHaveLength(1);
		expect(toolCallRows[0].tool.name).toBe('echo');
	});

	it('reports a ToolError message as the tool result instead of throwing', async () => {
		const session = await seedSession();
		const ctx = new ContextManager('system prompt', session.id);
		const failing = fakeTool('fail', async () => {
			throw new ToolError('nope');
		});
		const provider = new FakeModelProvider([
			{ content: '', toolCalls: [{ name: 'fail', args: {} }] },
			{ content: 'recovered' }
		]);
		const agent = new Agent(session.agentId, provider, ctx, [failing]);

		const result = await agent.run('try', undefined, new AbortController().signal);

		expect(result).toBe('recovered');
		const toolMessage = provider.calls[1].messages.find((m) => m.role === 'tool');
		expect(toolMessage?.content).toBe('nope');
	});

	it('skips an unknown tool call without crashing', async () => {
		const session = await seedSession();
		const ctx = new ContextManager('system prompt', session.id);
		const provider = new FakeModelProvider([
			{ content: '', toolCalls: [{ name: 'does_not_exist', args: {} }] },
			{ content: 'moved on' }
		]);
		const agent = new Agent(session.agentId, provider, ctx, []);

		const result = await agent.run('try', undefined, new AbortController().signal);

		expect(result).toBe('moved on');
	});

	it('retries when the model returns neither content nor tool calls', async () => {
		const session = await seedSession();
		const ctx = new ContextManager('system prompt', session.id);
		const provider = new FakeModelProvider([{ content: '' }, { content: 'finally' }]);
		const agent = new Agent(session.agentId, provider, ctx, []);

		const result = await agent.run('try', undefined, new AbortController().signal);

		expect(result).toBe('finally');
		expect(provider.calls).toHaveLength(2);
		const persisted = await db.query.messages.findMany({
			where: eq(messages.sessionId, session.id)
		});
		expect(persisted.some((m) => m.role === 'system' && m.content.includes('Retry'))).toBe(true);
	});

	it('resolves with a cancellation message instead of throwing when already aborted', async () => {
		const session = await seedSession();
		const ctx = new ContextManager('system prompt', session.id);
		const provider = new FakeModelProvider([]);
		const agent = new Agent(session.agentId, provider, ctx, []);
		const controller = new AbortController();
		controller.abort();

		const result = await agent.run('try', undefined, controller.signal);

		expect(result).toBe('Cancelled by user.');
		expect(provider.calls).toHaveLength(0);
	});

	it('stops after the iteration cap instead of looping forever', async () => {
		const session = await seedSession();
		const ctx = new ContextManager('system prompt', session.id);
		const provider = new FakeModelProvider(() => ({
			content: '',
			toolCalls: [{ name: 'noop', args: {} }]
		}));
		const noop = fakeTool('noop', async () => 'ok');
		const agent = new Agent(session.agentId, provider, ctx, [noop]);

		const result = await agent.run('try', undefined, new AbortController().signal);

		expect(result).toBe('Maximum iterations reached without completing task');
		expect(provider.calls).toHaveLength(20);
	});

	it('streams content deltas via onChunk while returning the same final content', async () => {
		const session = await seedSession();
		const ctx = new ContextManager('system prompt', session.id);
		const provider = new FakeModelProvider([{ content: 'streamed reply' }]);
		const agent = new Agent(session.agentId, provider, ctx, []);
		const chunks: string[] = [];

		const result = await agent.run(
			'try',
			(delta) => chunks.push(delta),
			new AbortController().signal
		);

		expect(result).toBe('streamed reply');
		expect(chunks).toEqual(['streamed reply']);
	});
});
