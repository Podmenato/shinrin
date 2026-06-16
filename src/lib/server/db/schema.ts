import { relations } from 'drizzle-orm';
import {
	integer,
	jsonb,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	unique
} from 'drizzle-orm/pg-core';

export const agents = pgTable('agents', {
	id: serial().primaryKey(),
	name: text().notNull().unique(),
	systemPrompt: text('system_prompt'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const tools = pgTable('tools', {
	id: serial().primaryKey(),
	name: text().notNull().unique(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const agentTools = pgTable(
	'agent_tools',
	{
		agentId: integer('agent_id')
			.notNull()
			.references(() => agents.id),
		toolId: integer('tool_id')
			.notNull()
			.references(() => tools.id)
	},
	(t) => [primaryKey({ columns: [t.agentId, t.toolId] })]
);

export const sessions = pgTable('sessions', {
	id: serial().primaryKey(),
	agentId: integer('agent_id')
		.notNull()
		.references(() => agents.id),
	name: text().notNull(),
	model: text().notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const messages = pgTable('messages', {
	id: serial().primaryKey(),
	sessionId: integer('session_id')
		.notNull()
		.references(() => sessions.id),
	role: text('role').notNull(),
	content: text('content').notNull(),
	toolName: text('tool_name'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const messageToolCalls = pgTable('message_tool_calls', {
	id: serial().primaryKey(),
	messageId: integer('message_id')
		.notNull()
		.references(() => messages.id),
	toolId: integer('tool_id')
		.notNull()
		.references(() => tools.id),
	args: jsonb('args')
});

export const memories = pgTable(
	'memories',
	{
		id: serial().primaryKey(),
		agentId: integer('agent_id')
			.notNull()
			.references(() => agents.id),
		key: text('key').notNull(),
		value: text('value').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(t) => [unique().on(t.agentId, t.key)]
);

export const agentsRelations = relations(agents, ({ many }) => ({
	agentTools: many(agentTools),
	sessions: many(sessions)
}));

export const toolsRelations = relations(tools, ({ many }) => ({
	agentTools: many(agentTools)
}));

export const agentToolsRelations = relations(agentTools, ({ one }) => ({
	agent: one(agents, { fields: [agentTools.agentId], references: [agents.id] }),
	tool: one(tools, { fields: [agentTools.toolId], references: [tools.id] })
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
	agent: one(agents, { fields: [sessions.agentId], references: [agents.id] }),
	messages: many(messages)
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
	session: one(sessions, { fields: [messages.sessionId], references: [sessions.id] }),
	messageToolCalls: many(messageToolCalls)
}));

export const messageToolCallsRelations = relations(messageToolCalls, ({ one }) => ({
	message: one(messages, { fields: [messageToolCalls.messageId], references: [messages.id] }),
	tool: one(tools, { fields: [messageToolCalls.toolId], references: [tools.id] })
}));

export const memoriesRelations = relations(memories, ({ one }) => ({
	agent: one(agents, { fields: [memories.agentId], references: [agents.id] })
}));
