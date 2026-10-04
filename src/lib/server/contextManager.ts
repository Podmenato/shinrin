import { eq } from 'drizzle-orm';
import { db } from './db/index';
import {
	messageToolCalls,
	messages as messagesTable,
	sessions as sessionsTable,
	tools as toolsTable
} from './db/schema';
import type { ModelProvider } from './modelProviders/modelProvider';
import type { JsonValue } from '#lib/json.js';
import { messageRegistry } from './messageRegistry';

export type ToolCall = {
	/** Our own id — the `message_tool_calls` primary key, referenced by its result's `toolCallId`. */
	id: string;
	/** The provider's own id for this call, if it assigned one (Anthropic's `toolu_...`). */
	providerCallId?: string;
	name: string;
	args: Record<string, JsonValue>;
};

export type Message = {
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string;
	toolCalls?: ToolCall[];
	toolName?: string;
	/** Set only on `role: 'tool'` messages — the ToolCall.id this message is the result of. */
	toolCallId?: string;
	model?: string;
	/**
	 * The provider's own representation of this exact assistant turn — see
	 * ModelResponse.providerContent. Only ever set on the in-memory turn just produced by the
	 * current run; not persisted. Tool-call ids are persisted separately (ToolCall.providerCallId),
	 * so what this carries beyond the stored fields is Anthropic's thinking blocks — and those are
	 * bound to the exact conversation prefix (system prompt, tools, earlier messages) that produced
	 * them, which in this app often changes between runs (e.g. fetch_url's tool description lists
	 * the conversation's URLs), so a stored copy would frequently be rejected on replay anyway.
	 */
	providerContent?: unknown;
};

const COMPACTION_INSTRUCTION = `Ignore your instructions above for this response only, and do not stay in character. Summarize the conversation above so it can continue with less history in context. Write a concise but complete summary that preserves: topics covered, preferences or decisions the user expressed, and any unresolved question or pending tasks. Respond in English, as a neutral summarizer. Write only the summary, with no preamble or commentary about the summarization itself.`;

export class ContextManager {
	private history: Message[] = [];
	private sessionId: string;
	private systemPrompt: string;
	private summary: string | null = null;
	private summarizedThroughMessageId: string | null = null;

	constructor(systemPrompt: string, sessionId: string) {
		this.systemPrompt = systemPrompt;
		this.sessionId = sessionId;
	}

	async add(message: Message): Promise<void> {
		this.history.push(message);
		const [inserted] = await db
			.insert(messagesTable)
			.values({
				sessionId: this.sessionId,
				role: message.role,
				content: message.content,
				toolName: message.toolName,
				toolCallId: message.toolCallId,
				model: message.model
			})
			.returning();

		if (message.toolCalls) {
			for (const toolCall of message.toolCalls) {
				const [dbTool] = await db
					.select()
					.from(toolsTable)
					.where(eq(toolsTable.name, toolCall.name));
				await db.insert(messageToolCalls).values({
					id: toolCall.id,
					messageId: inserted.id,
					name: toolCall.name,
					providerCallId: toolCall.providerCallId,
					toolId: dbTool?.id,
					args: toolCall.args
				});
			}
		}

		messageRegistry.notify(this.sessionId);
	}

	build(): Message[] {
		const messages: Message[] = [{ role: 'system', content: this.systemPrompt }];
		if (this.summary) {
			messages.push({
				role: 'system',
				content: `Summary of the conversation so far:\n${this.summary}`
			});
		}
		messages.push(...this.history);
		return messages;
	}

	async load(): Promise<void> {
		const session = await db.query.sessions.findFirst({
			where: { id: this.sessionId }
		});
		this.summary = session?.summary ?? null;
		this.summarizedThroughMessageId = session?.summarizedThroughMessageId ?? null;

		const cutoffMessage = this.summarizedThroughMessageId
			? await db.query.messages.findFirst({
					where: { id: this.summarizedThroughMessageId },
					columns: { createdAt: true }
				})
			: undefined;

		const dbMessages = await db.query.messages.findMany({
			where: cutoffMessage
				? { sessionId: this.sessionId, createdAt: { gt: cutoffMessage.createdAt } }
				: { sessionId: this.sessionId },
			orderBy: { createdAt: 'asc' },
			with: { messageToolCalls: true }
		});

		this.history = dbMessages.map((msg) => ({
			role: msg.role as Message['role'],
			content: msg.content,
			toolName: msg.toolName ?? undefined,
			toolCallId: msg.toolCallId ?? undefined,
			toolCalls:
				msg.messageToolCalls.length > 0
					? msg.messageToolCalls.map((tc) => ({
							id: tc.id,
							providerCallId: tc.providerCallId ?? undefined,
							name: tc.name,
							args: tc.args as Record<string, JsonValue>
						}))
					: undefined
		}));
	}

	async compact(provider: ModelProvider, model: string): Promise<void> {
		if (this.history.length === 0) {
			return;
		}

		const cutoff = await db.query.messages.findFirst({
			where: { sessionId: this.sessionId },
			orderBy: { createdAt: 'desc' }
		});

		if (cutoff === undefined) {
			return;
		}

		const messages: Message[] = [
			...this.build(),
			{ role: 'user', content: COMPACTION_INSTRUCTION }
		];

		// TODO: hack to satisfy the type, needs to get an actual signal
		const response = await provider.chat(model, messages, [], new AbortController().signal);

		await db
			.update(sessionsTable)
			.set({ summary: response.content, summarizedThroughMessageId: cutoff.id })
			.where(eq(sessionsTable.id, this.sessionId));

		this.summary = response.content;
		this.summarizedThroughMessageId = cutoff.id;
		this.history = [];
	}

	clear(): void {
		this.history = [];
	}
}
