import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-valibot';
import {
	agents,
	sessions,
	messages,
	memories,
	studyTopics,
	mistakeObservations,
	tools,
	subjects
} from './schema';
import * as v from 'valibot';

const uuid = v.pipe(v.string(), v.uuid());
const nullableUuid = v.nullable(uuid);

export const insertAgentSchema = createInsertSchema(agents, { id: uuid, subjectId: nullableUuid });
export const selectAgentSchema = createSelectSchema(agents, { id: uuid, subjectId: nullableUuid });

export const insertSessionSchema = createInsertSchema(sessions, { id: uuid, agentId: uuid });
export const selectSessionSchema = createSelectSchema(sessions, { id: uuid, agentId: uuid });

export const insertMessageSchema = createInsertSchema(messages, { id: uuid, sessionId: uuid });
export const selectMessageSchema = createSelectSchema(messages, { id: uuid, sessionId: uuid });

export const insertMemorySchema = createInsertSchema(memories, { id: uuid, agentId: uuid });
export const updateMemorySchema = createUpdateSchema(memories, { id: uuid, agentId: uuid });

export const insertStudyTopicSchema = createInsertSchema(studyTopics, {
	id: uuid,
	subjectId: uuid
});
export const updateStudyTopicSchema = createUpdateSchema(studyTopics, {
	id: uuid,
	subjectId: uuid
});

export const insertMistakeObservationSchema = createInsertSchema(mistakeObservations, {
	id: uuid,
	subjectId: uuid
});

export const insertToolSchema = createInsertSchema(tools, { id: uuid });

export const insertSubjectSchema = createInsertSchema(subjects, { id: uuid });
export const selectSubjectSchema = createSelectSchema(subjects, { id: uuid });
