import { and, asc, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from './db/index';
import {
	messageToolCalls,
	messages as messagesTable,
	sessions as sessionsTable,
	tools as toolsTable
} from './db/schema';
import type { ModelProvider } from './modelProviders/modelProvider';

export type ToolCall = {
	name: string;
	args: Record<string, string>;
};

export type Message = {
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string;
	toolCalls?: ToolCall[];
	toolName?: string;
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
				toolName: message.toolName
			})
			.returning();

		if (message.toolCalls) {
			for (const toolCall of message.toolCalls) {
				const [dbTool] = await db
					.select()
					.from(toolsTable)
					.where(eq(toolsTable.name, toolCall.name));
				if (dbTool) {
					await db.insert(messageToolCalls).values({
						messageId: inserted.id,
						toolId: dbTool.id,
						args: toolCall.args
					});
				}
			}
		}
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
			where: eq(sessionsTable.id, this.sessionId)
		});
		this.summary = session?.summary ?? null;
		this.summarizedThroughMessageId = session?.summarizedThroughMessageId ?? null;

		const dbMessages = await db.query.messages.findMany({
			where: this.summarizedThroughMessageId
				? and(
						eq(messagesTable.sessionId, this.sessionId),
						gt(
							messagesTable.createdAt,
							sql`(select created_at from messages where id = ${this.summarizedThroughMessageId})`
						)
					)
				: eq(messagesTable.sessionId, this.sessionId),
			orderBy: asc(messagesTable.createdAt),
			with: { messageToolCalls: { with: { tool: true } } }
		});

		this.history = dbMessages.map((msg) => ({
			role: msg.role as Message['role'],
			content: msg.content,
			toolName: msg.toolName ?? undefined,
			toolCalls:
				msg.messageToolCalls.length > 0
					? msg.messageToolCalls.map((tc) => ({
							name: tc.tool.name,
							args: tc.args as Record<string, string>
						}))
					: undefined
		}));
	}

	async compact(provider: ModelProvider): Promise<void> {
		if (this.history.length === 0) {
			return;
		}

		const cutoff = await db.query.messages.findFirst({
			where: eq(messagesTable.sessionId, this.sessionId),
			orderBy: desc(messagesTable.createdAt)
		});

		if (cutoff === undefined) {
			return;
		}

		const messages: Message[] = [
			...this.build(),
			{ role: 'user', content: COMPACTION_INSTRUCTION }
		];

		const response = await provider.chat(messages, []);

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
