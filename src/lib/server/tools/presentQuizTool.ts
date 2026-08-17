import type { Tool, ToolDefinition } from './tool';
import { ToolError } from './tool';
import * as v from 'valibot';
import { quizSchema } from '#lib/quiz.js';
import { toJsonObjectSchema, type JsonValue } from '#lib/json.js';

export class PresentQuizTool implements Tool {
	definition: ToolDefinition = {
		name: 'present_quiz',
		description:
			'Present an interactive quiz to the user and wait for them to answer before continuing — ' +
			'do not ask the questions again yourself in your reply, the UI renders them. ' +
			"Supported question types: 'single_choice' (exactly one correct option) and " +
			"'multiple_choice' (one or more correct options). You must already know and provide the " +
			'correct answer(s) yourself — the user only sees the questions and options, never the answers.',
		parameters: toJsonObjectSchema({
			questions: {
				type: 'array',
				description: 'The quiz questions, in order.',
				items: toJsonObjectSchema({
					question: { type: 'string', description: 'The question text.' },
					questionType: {
						type: 'string',
						enum: ['single_choice', 'multiple_choice'],
						description:
							'The question type — this field itself must be filled in with one of the two enum values below.'
					},
					options: {
						type: 'array',
						items: { type: 'string' },
						description: 'The answer choices, at least two.'
					},
					answer: {
						type: 'array',
						items: { type: 'integer' },
						description:
							'0-based index/indices into options for the correct answer(s): exactly one ' +
							"index for 'single_choice', one or more for 'multiple_choice'."
					}
				})
			}
		})
	};

	async execute(args: Record<string, JsonValue>): Promise<string> {
		const result = v.safeParse(quizSchema, args);
		if (!result.success) {
			throw new ToolError(`Invalid quiz: ${v.summarize(result.issues)}`);
		}

		return 'Quiz presented to the user. Wait for their answers before continuing.';
	}
}
