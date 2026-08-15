import { relations } from 'drizzle-orm';
import {
	type AnySQLiteColumn,
	integer,
	primaryKey,
	sqliteTable,
	text,
	unique
} from 'drizzle-orm/sqlite-core';

const generateUUID = () =>
	text()
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
	integer({ mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date());
const updatedAt = () =>
	integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date());

export const subjects = sqliteTable('subjects', {
	id: generateUUID(),
	name: text().notNull().unique(),
	description: text(),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const agents = sqliteTable('agents', {
	id: generateUUID(),
	name: text().notNull().unique(),
	systemPrompt: text('system_prompt'),
	isSubagent: integer('is_subagent', { mode: 'boolean' }).notNull().default(false),
	subagentDescription: text('subagent_description'),
	defaultModel: text('default_model'),
	subjectId: text('subject_id').references(() => subjects.id),
	deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const tools = sqliteTable('tools', {
	id: generateUUID(),
	name: text().notNull().unique(),
	isSubjectRequired: integer('is_subject_required', { mode: 'boolean' }).notNull().default(false),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const agentTools = sqliteTable(
	'agent_tools',
	{
		agentId: text('agent_id')
			.notNull()
			.references(() => agents.id),
		toolId: text('tool_id')
			.notNull()
			.references(() => tools.id)
	},
	(t) => [primaryKey({ columns: [t.agentId, t.toolId] })]
);

export const agentSubagents = sqliteTable(
	'agent_subagents',
	{
		agentId: text('agent_id')
			.notNull()
			.references(() => agents.id),
		subagentId: text('subagent_id')
			.notNull()
			.references(() => agents.id)
	},
	(t) => [primaryKey({ columns: [t.agentId, t.subagentId] })]
);

export const sessions = sqliteTable('sessions', {
	id: generateUUID(),
	agentId: text('agent_id')
		.notNull()
		.references(() => agents.id),
	name: text().notNull(),
	model: text().notNull(),
	systemPrompt: text('system_prompt'),
	summary: text('summary'),
	parentSessionId: text('parent_session_id').references((): AnySQLiteColumn => sessions.id),
	summarizedThroughMessageId: text('summarized_through_message_id').references(
		(): AnySQLiteColumn => messages.id
	),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const messages = sqliteTable('messages', {
	id: generateUUID(),
	sessionId: text('session_id')
		.notNull()
		.references(() => sessions.id),
	role: text('role').notNull(),
	content: text('content').notNull(),
	toolName: text('tool_name'),
	createdAt: createdAt()
});

export const messageToolCalls = sqliteTable('message_tool_calls', {
	id: generateUUID(),
	messageId: text('message_id')
		.notNull()
		.references(() => messages.id),
	toolId: text('tool_id')
		.notNull()
		.references(() => tools.id),
	args: text('args', { mode: 'json' })
});

export const memories = sqliteTable(
	'memories',
	{
		id: generateUUID(),
		agentId: text('agent_id')
			.notNull()
			.references(() => agents.id),
		key: text('key').notNull(),
		value: text('value').notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [unique().on(t.agentId, t.key)]
);

export const studyTopics = sqliteTable(
	'study_topics',
	{
		id: generateUUID(),
		subjectId: text('subject_id')
			.notNull()
			.references(() => subjects.id),
		topic: text('topic').notNull(),
		status: text('status').notNull(),
		notes: text('notes'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [unique().on(t.subjectId, t.topic)]
);

export const mistakeObservations = sqliteTable('mistake_observations', {
	id: generateUUID(),
	subjectId: text('subject_id')
		.notNull()
		.references(() => subjects.id),
	title: text('title').notNull(),
	note: text('note').notNull(),
	createdAt: createdAt()
});

export const stories = sqliteTable('stories', {
	id: generateUUID(),
	title: text('title').notNull(),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const storyContent = sqliteTable(
	'story_content',
	{
		id: generateUUID(),
		storyId: text('story_id')
			.notNull()
			.references(() => stories.id),
		subjectId: text('subject_id')
			.notNull()
			.references(() => subjects.id),
		content: text('content').notNull(),
		stale: integer('stale', { mode: 'boolean' }).notNull().default(false),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [unique().on(t.storyId, t.subjectId)]
);

export const files = sqliteTable('files', {
	id: generateUUID(),
	path: text('path').notNull(),
	mimeType: text('mime_type').notNull(),
	sizeBytes: integer('size_bytes').notNull(),
	createdAt: createdAt()
});

export const storyResources = sqliteTable('story_resources', {
	id: generateUUID(),
	storyId: text('story_id')
		.notNull()
		.references(() => stories.id),
	fileId: text('file_id')
		.notNull()
		.references(() => files.id),
	label: text('label'),
	createdAt: createdAt()
});

export const subjectsRelations = relations(subjects, ({ many }) => ({
	agents: many(agents),
	studyTopics: many(studyTopics),
	mistakeObservations: many(mistakeObservations),
	storyContent: many(storyContent)
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

export const storiesRelations = relations(stories, ({ many }) => ({
	content: many(storyContent),
	resources: many(storyResources)
}));

export const storyContentRelations = relations(storyContent, ({ one }) => ({
	story: one(stories, { fields: [storyContent.storyId], references: [stories.id] }),
	subject: one(subjects, { fields: [storyContent.subjectId], references: [subjects.id] })
}));

export const filesRelations = relations(files, ({ many }) => ({
	storyResources: many(storyResources)
}));

export const storyResourcesRelations = relations(storyResources, ({ one }) => ({
	story: one(stories, { fields: [storyResources.storyId], references: [stories.id] }),
	file: one(files, { fields: [storyResources.fileId], references: [files.id] })
}));
