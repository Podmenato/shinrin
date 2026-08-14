import * as v from 'valibot';

const questionBase = {
	question: v.pipe(v.string(), v.nonEmpty()),
	options: v.pipe(v.array(v.string()), v.minLength(2))
};

export const singleChoiceQuestionSchema = v.object({
	...questionBase,
	questionType: v.literal('single_choice'),
	answer: v.pipe(
		v.array(v.number()),
		v.length(1),
		v.transform((indices) => indices[0])
	)
});

export const multipleChoiceQuestionSchema = v.object({
	...questionBase,
	questionType: v.literal('multiple_choice'),
	answer: v.pipe(v.array(v.number()), v.minLength(1))
});

export const quizQuestionSchema = v.variant('questionType', [
	singleChoiceQuestionSchema,
	multipleChoiceQuestionSchema
]);

export const quizSchema = v.object({
	questions: v.pipe(v.array(quizQuestionSchema), v.minLength(1))
});

export type SingleChoiceQuestion = v.InferOutput<typeof singleChoiceQuestionSchema>;
export type MultipleChoiceQuestion = v.InferOutput<typeof multipleChoiceQuestionSchema>;
export type QuizQuestion = v.InferOutput<typeof quizQuestionSchema>;
export type Quiz = v.InferOutput<typeof quizSchema>;
