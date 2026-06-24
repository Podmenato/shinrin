import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-valibot';
import {
	agents,
	sessions,
	messages,
	memories,
	studyTopics,
	mistakeObservations,
	tools
} from './schema';
import * as v from 'valibot';

const uuid = v.pipe(v.string(), v.uuid());

export const insertAgentSchema = createInsertSchema(agents, { id: uuid });
export const selectAgentSchema = createSelectSchema(agents, { id: uuid });

export const insertSessionSchema = createInsertSchema(sessions, { id: uuid, agentId: uuid });
export const selectSessionSchema = createSelectSchema(sessions, { id: uuid, agentId: uuid });

export const insertMessageSchema = createInsertSchema(messages, { id: uuid, sessionId: uuid });
export const selectMessageSchema = createSelectSchema(messages, { id: uuid, sessionId: uuid });

export const insertMemorySchema = createInsertSchema(memories, { id: uuid, agentId: uuid });
export const updateMemorySchema = createUpdateSchema(memories, { id: uuid, agentId: uuid });

export const insertStudyTopicSchema = createInsertSchema(studyTopics, { id: uuid, agentId: uuid });
export const updateStudyTopicSchema = createUpdateSchema(studyTopics, { id: uuid, agentId: uuid });

export const insertMistakeObservationSchema = createInsertSchema(mistakeObservations, {
	id: uuid,
	agentId: uuid
});

export const insertToolSchema = createInsertSchema(tools, { id: uuid });
