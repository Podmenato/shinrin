import { defineRelations } from 'drizzle-orm';
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
	readingDeck: text('reading_deck'),
	productionDeck: text('production_deck'),
	listeningDeck: text('listening_deck'),
	autoAddAgentId: text('auto_add_agent_id')
		.notNull()
		.references((): AnySQLiteColumn => agents.id),
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
	parentSessionId: text('parent_session_id').references((): AnySQLiteColumn => sessions.id, {
		onDelete: 'cascade'
	}),
	summarizedThroughMessageId: text('summarized_through_message_id').references(
		(): AnySQLiteColumn => messages.id,
		{ onDelete: 'set null' }
	),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const messages = sqliteTable('messages', {
	id: generateUUID(),
	sessionId: text('session_id')
		.notNull()
		.references(() => sessions.id, { onDelete: 'cascade' }),
	role: text('role').notNull(),
	content: text('content').notNull(),
	toolName: text('tool_name'),
	createdAt: createdAt()
});

export const messageToolCalls = sqliteTable('message_tool_calls', {
	id: generateUUID(),
	messageId: text('message_id')
		.notNull()
		.references(() => messages.id, { onDelete: 'cascade' }),
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

export const quickAsks = sqliteTable('quick_asks', {
	id: generateUUID(),
	name: text().notNull(),
	agentId: text('agent_id')
		.notNull()
		.references(() => agents.id),
	model: text().notNull(),
	deck: text().notNull(),
	state: text().notNull(),
	days: integer('days'),
	prompt: text('prompt').notNull(),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

// RQBv1's `relations()` was replaced by RQBv2's `defineRelations()` in drizzle-orm v1 — every
// relation now states its own `from`/`to` explicitly, which is also why the old `relationName`
// disambiguation on agentSubagents' two agents-pointing FKs (agentId vs subagentId) is no longer
// needed: each relation's own `to` already says which column it's through.
// `r.one.X(...)` defaults to `optional: true` regardless of the underlying FK's own nullability
// (unlike v1, which inferred it from the FK column) — every one() below sets `optional: false`
// except agents.subject, since agents.subjectId is the only genuinely-nullable FK in this schema.
const schemaTables = {
	subjects,
	agents,
	tools,
	agentTools,
	agentSubagents,
	sessions,
	messages,
	messageToolCalls,
	memories,
	studyTopics,
	mistakeObservations,
	stories,
	storyContent,
	files,
	storyResources,
	quickAsks
};

export const relations = defineRelations(schemaTables, (r) => ({
	subjects: {
		agents: r.many.agents({ from: r.subjects.id, to: r.agents.subjectId }),
		studyTopics: r.many.studyTopics({ from: r.subjects.id, to: r.studyTopics.subjectId }),
		mistakeObservations: r.many.mistakeObservations({
			from: r.subjects.id,
			to: r.mistakeObservations.subjectId
		}),
		storyContent: r.many.storyContent({ from: r.subjects.id, to: r.storyContent.subjectId }),
		autoAddAgent: r.one.agents({
			from: r.subjects.autoAddAgentId,
			to: r.agents.id,
			optional: false
		})
	},
	agents: {
		subject: r.one.subjects({ from: r.agents.subjectId, to: r.subjects.id }),
		agentTools: r.many.agentTools({ from: r.agents.id, to: r.agentTools.agentId }),
		sessions: r.many.sessions({ from: r.agents.id, to: r.sessions.agentId }),
		subagents: r.many.agentSubagents({ from: r.agents.id, to: r.agentSubagents.agentId }),
		subagentOf: r.many.agentSubagents({ from: r.agents.id, to: r.agentSubagents.subagentId }),
		quickAsks: r.many.quickAsks({ from: r.agents.id, to: r.quickAsks.agentId })
	},
	tools: {
		agentTools: r.many.agentTools({ from: r.tools.id, to: r.agentTools.toolId })
	},
	agentTools: {
		agent: r.one.agents({ from: r.agentTools.agentId, to: r.agents.id, optional: false }),
		tool: r.one.tools({ from: r.agentTools.toolId, to: r.tools.id, optional: false })
	},
	agentSubagents: {
		agent: r.one.agents({ from: r.agentSubagents.agentId, to: r.agents.id, optional: false }),
		subagent: r.one.agents({
			from: r.agentSubagents.subagentId,
			to: r.agents.id,
			optional: false
		})
	},
	sessions: {
		agent: r.one.agents({ from: r.sessions.agentId, to: r.agents.id, optional: false }),
		messages: r.many.messages({ from: r.sessions.id, to: r.messages.sessionId })
	},
	messages: {
		session: r.one.sessions({ from: r.messages.sessionId, to: r.sessions.id, optional: false }),
		messageToolCalls: r.many.messageToolCalls({
			from: r.messages.id,
			to: r.messageToolCalls.messageId
		})
	},
	messageToolCalls: {
		message: r.one.messages({
			from: r.messageToolCalls.messageId,
			to: r.messages.id,
			optional: false
		}),
		tool: r.one.tools({ from: r.messageToolCalls.toolId, to: r.tools.id, optional: false })
	},
	memories: {
		agent: r.one.agents({ from: r.memories.agentId, to: r.agents.id, optional: false })
	},
	studyTopics: {
		subject: r.one.subjects({ from: r.studyTopics.subjectId, to: r.subjects.id, optional: false })
	},
	mistakeObservations: {
		subject: r.one.subjects({
			from: r.mistakeObservations.subjectId,
			to: r.subjects.id,
			optional: false
		})
	},
	stories: {
		content: r.many.storyContent({ from: r.stories.id, to: r.storyContent.storyId }),
		resources: r.many.storyResources({ from: r.stories.id, to: r.storyResources.storyId })
	},
	storyContent: {
		story: r.one.stories({ from: r.storyContent.storyId, to: r.stories.id, optional: false }),
		subject: r.one.subjects({
			from: r.storyContent.subjectId,
			to: r.subjects.id,
			optional: false
		})
	},
	files: {
		storyResources: r.many.storyResources({ from: r.files.id, to: r.storyResources.fileId })
	},
	storyResources: {
		story: r.one.stories({ from: r.storyResources.storyId, to: r.stories.id, optional: false }),
		file: r.one.files({ from: r.storyResources.fileId, to: r.files.id, optional: false })
	},
	quickAsks: {
		agent: r.one.agents({ from: r.quickAsks.agentId, to: r.agents.id, optional: false })
	}
}));
