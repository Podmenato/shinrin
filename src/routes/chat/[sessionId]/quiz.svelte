<script lang="ts">
	import * as v from 'valibot';
	import { quizSchema, type QuizQuestion } from '#lib/quiz.js';
	import type { JsonValue } from '#lib/json.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import SingleChoiceQuestion from './single-choice-question.svelte';
	import MultipleChoiceQuestion from './multiple-choice-question.svelte';

	const { args }: { args: Record<string, JsonValue> } = $props();

	const parsed = $derived(v.safeParse(quizSchema, args));
	const questions = $derived(parsed.success ? parsed.output.questions : []);

	// Keyed by question index; single_choice stores the picked option index, multiple_choice an
	// array of picked option indices.
	let selections = $state<Record<number, number | number[]>>({});
	let submitted = $state(false);

	function isCorrect(question: QuizQuestion, questionIndex: number): boolean {
		if (question.questionType === 'single_choice') {
			return selections[questionIndex] === question.answer;
		}
		const picked = new Set((selections[questionIndex] as number[] | undefined) ?? []);
		const correct = question.answer;
		return picked.size === correct.length && correct.every((i) => picked.has(i));
	}

	const score = $derived(
		submitted ? questions.filter((q, i) => isCorrect(q, i)).length : undefined
	);
</script>

{#if !parsed.success}
	<div class="rounded-md border border-destructive/50 px-3 py-2 text-xs text-destructive">
		Couldn't render this quiz — it didn't match the expected format.
	</div>
{:else}
	<Card.Root>
		<Card.Content>
			<Field.Group>
				{#each questions as question, questionIndex (questionIndex)}
					{#if question.questionType === 'single_choice'}
						<SingleChoiceQuestion
							{question}
							index={questionIndex}
							selected={selections[questionIndex] as number | undefined}
							onSelect={(optionIndex) => (selections[questionIndex] = optionIndex)}
							disabled={submitted}
							showResult={submitted}
						/>
					{:else}
						<MultipleChoiceQuestion
							{question}
							index={questionIndex}
							selected={(selections[questionIndex] as number[] | undefined) ?? []}
							onChange={(optionIndex, checked) => {
								const current = (selections[questionIndex] as number[] | undefined) ?? [];
								selections[questionIndex] = checked
									? [...current, optionIndex]
									: current.filter((i) => i !== optionIndex);
							}}
							disabled={submitted}
							showResult={submitted}
						/>
					{/if}
				{/each}
			</Field.Group>
		</Card.Content>
		<Card.Footer>
			{#if !submitted}
				<Button onclick={() => (submitted = true)}>Submit</Button>
			{:else}
				<p class="text-sm font-medium">Score: {score} / {questions.length}</p>
			{/if}
		</Card.Footer>
	</Card.Root>
{/if}
