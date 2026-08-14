<script lang="ts">
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import * as Field from '$lib/components/ui/field';
	import { cn } from '$lib/utils';
	import type { SingleChoiceQuestion } from '$lib/quiz';

	const {
		question,
		index,
		selected,
		onSelect,
		disabled,
		showResult
	}: {
		question: SingleChoiceQuestion;
		index: number;
		selected: number | undefined;
		onSelect: (optionIndex: number) => void;
		disabled: boolean;
		showResult: boolean;
	} = $props();
</script>

<Field.Set>
	<Field.Legend variant="label">{question.question}</Field.Legend>
	<RadioGroup
		value={selected === undefined ? '' : String(selected)}
		onValueChange={(value) => onSelect(Number(value))}
		{disabled}
	>
		{#each question.options as option, optionIndex (optionIndex)}
			{@const isCorrectOption = showResult && optionIndex === question.answer}
			{@const isWrongPick =
				showResult && selected === optionIndex && optionIndex !== question.answer}
			<Field.Field orientation="horizontal">
				<RadioGroupItem
					value={String(optionIndex)}
					id="quiz-{index}-{optionIndex}"
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
	</RadioGroup>
</Field.Set>
