import { relations } from 'drizzle-orm';
import {
	type AnyPgColumn,
	boolean,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uuid
} from 'drizzle-orm/pg-core';

export const subjects = pgTable('subjects', {
	id: uuid().primaryKey().defaultRandom(),
	name: text().notNull().unique(),
	description: text(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const agents = pgTable('agents', {
	id: uuid().primaryKey().defaultRandom(),
	name: text().notNull().unique(),
	systemPrompt: text('system_prompt'),
	isSubagent: boolean('is_subagent').notNull().default(false),
	subagentDescription: text('subagent_description'),
	defaultModel: text('default_model'),
	subjectId: uuid('subject_id').references(() => subjects.id),
	deletedAt: timestamp('deleted_at'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const tools = pgTable('tools', {
	id: uuid().primaryKey().defaultRandom(),
	name: text().notNull().unique(),
	isSubjectRequired: boolean('is_subject_required').notNull().default(false),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const agentTools = pgTable(
	'agent_tools',
	{
		agentId: uuid('agent_id')
			.notNull()
			.references(() => agents.id),
		toolId: uuid('tool_id')
			.notNull()
			.references(() => tools.id)
	},
	(t) => [primaryKey({ columns: [t.agentId, t.toolId] })]
);

export const agentSubagents = pgTable(
	'agent_subagents',
	{
		agentId: uuid('agent_id')
			.notNull()
			.references(() => agents.id),
		subagentId: uuid('subagent_id')
			.notNull()
			.references(() => agents.id)
	},
	(t) => [primaryKey({ columns: [t.agentId, t.subagentId] })]
);

export const sessions = pgTable('sessions', {
	id: uuid().primaryKey().defaultRandom(),
	agentId: uuid('agent_id')
		.notNull()
		.references(() => agents.id),
	name: text().notNull(),
	model: text().notNull(),
	systemPrompt: text('system_prompt'),
	summary: text('summary'),
	summarizedThroughMessageId: uuid('summarized_through_message_id').references(
		(): AnyPgColumn => messages.id
	),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const messages = pgTable('messages', {
	id: uuid().primaryKey().defaultRandom(),
	sessionId: uuid('session_id')
		.notNull()
		.references(() => sessions.id),
	role: text('role').notNull(),
	content: text('content').notNull(),
	toolName: text('tool_name'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const messageToolCalls = pgTable('message_tool_calls', {
	id: uuid().primaryKey().defaultRandom(),
	messageId: uuid('message_id')
		.notNull()
		.references(() => messages.id),
	toolId: uuid('tool_id')
		.notNull()
		.references(() => tools.id),
	args: jsonb('args')
});

export const memories = pgTable(
	'memories',
	{
		id: uuid().primaryKey().defaultRandom(),
		agentId: uuid('agent_id')
			.notNull()
			.references(() => agents.id),
		key: text('key').notNull(),
		value: text('value').notNull(),
		deletedAt: timestamp('deleted_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(t) => [unique().on(t.agentId, t.key)]
);

export const studyTopics = pgTable(
	'study_topics',
	{
		id: uuid().primaryKey().defaultRandom(),
		subjectId: uuid('subject_id')
			.notNull()
			.references(() => subjects.id),
		topic: text('topic').notNull(),
		status: text('status').notNull(),
		notes: text('notes'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(t) => [unique().on(t.subjectId, t.topic)]
);

export const mistakeObservations = pgTable('mistake_observations', {
	id: uuid().primaryKey().defaultRandom(),
	subjectId: uuid('subject_id')
		.notNull()
		.references(() => subjects.id),
	title: text('title').notNull(),
	note: text('note').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const subjectsRelations = relations(subjects, ({ many }) => ({
	agents: many(agents),
	studyTopics: many(studyTopics),
	mistakeObservations: many(mistakeObservations)
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
	subject: one(subjects, { fields: [agents.subjectId], references: [subjects.id] }),
	agentTools: many(agentTools),
	sessions: many(sessions),
	subagents: many(agentSubagents, { relationName: 'parent' }),
	subagentOf: many(agentSubagents, { relationName: 'child' })
}));

export const toolsRelations = relations(tools, ({ many }) => ({
	agentTools: many(agentTools)
}));

export const agentToolsRelations = relations(agentTools, ({ one }) => ({
	agent: one(agents, { fields: [agentTools.agentId], references: [agents.id] }),
	tool: one(tools, { fields: [agentTools.toolId], references: [tools.id] })
}));

export const agentSubagentsRelations = relations(agentSubagents, ({ one }) => ({
	agent: one(agents, {
		fields: [agentSubagents.agentId],
		references: [agents.id],
		relationName: 'parent'
	}),
	subagent: one(agents, {
		fields: [agentSubagents.subagentId],
		references: [agents.id],
		relationName: 'child'
	})
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

export const studyTopicsRelations = relations(studyTopics, ({ one }) => ({
	subject: one(subjects, { fields: [studyTopics.subjectId], references: [subjects.id] })
}));

export const mistakeObservationsRelations = relations(mistakeObservations, ({ one }) => ({
	subject: one(subjects, { fields: [mistakeObservations.subjectId], references: [subjects.id] })
}));
