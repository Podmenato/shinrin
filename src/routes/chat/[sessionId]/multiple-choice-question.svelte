<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Field from '$lib/components/ui/field';
	import { cn } from '$lib/utils';
	import type { MultipleChoiceQuestion } from '$lib/quiz';

	const {
		question,
		index,
		selected,
		onChange,
		disabled,
		showResult
	}: {
		question: MultipleChoiceQuestion;
		index: number;
		selected: number[];
		onChange: (optionIndex: number, checked: boolean) => void;
		disabled: boolean;
		showResult: boolean;
	} = $props();
</script>

<Field.Set>
	<Field.Legend variant="label">{question.question}</Field.Legend>
	{#each question.options as option, optionIndex (optionIndex)}
		{@const isCorrectOption = showResult && question.answer.includes(optionIndex)}
		{@const isWrongPick =
			showResult && selected.includes(optionIndex) && !question.answer.includes(optionIndex)}
		<Field.Field orientation="horizontal">
			<Checkbox
				id="quiz-{index}-{optionIndex}"
				checked={selected.includes(optionIndex)}
				{disabled}
				onCheckedChange={(checked) => onChange(optionIndex, checked)}
				class={cn(isCorrectOption && 'border-primary', isWrongPick && 'border-destructive')}
			/>
			<Field.Label
				for="quiz-{index}-{optionIndex}"
				class={cn(
					'font-normal',
					isCorrectOption && 'text-primary',
					isWrongPick && 'text-destructive'
				)}
			>
				{option}
			</Field.Label>
		</Field.Field>
	{/each}
</Field.Set>
