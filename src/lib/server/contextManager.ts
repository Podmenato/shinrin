import { asc, eq } from 'drizzle-orm';
import { db } from './db/index';
import { messageToolCalls, messages as messagesTable, tools as toolsTable } from './db/schema';

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

export class ContextManager {
	private history: Message[] = [];
	private sessionId: number;
	private systemPrompt: string;

	constructor(systemPrompt: string, sessionId: number) {
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
		return [{ role: 'system', content: this.systemPrompt }, ...this.history];
	}

	async load(): Promise<void> {
		const dbMessages = await db.query.messages.findMany({
			where: eq(messagesTable.sessionId, this.sessionId),
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

	clear(): void {
		this.history = [];
	}
}
