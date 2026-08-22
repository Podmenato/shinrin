<script lang="ts">
	import { getDecks } from '#lib/anki.remote.js';
	import { addSentenceCard } from '#lib/chatAnki.remote.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import { toast } from 'svelte-sonner';

	// TODO: context actions will be redone, review if this still makes sense after
	export type CardFields = {
		sentence: string;
		translation: string;
		reading: string;
		notes: string;
		tagsInput: string;
		readingDeck: string;
		productionDeck: string;
		listeningDeck: string;
	};

	let {
		open = $bindable(false),
		fields,
		generating = false
	}: {
		open: boolean;
		fields: CardFields;
		generating?: boolean;
	} = $props();

	const decks = $derived(await getDecks());
	let submitting = $state(false);

	const deckSlots = [
		{ key: 'readingDeck', label: 'Reading deck' },
		{ key: 'productionDeck', label: 'Production deck' },
		{ key: 'listeningDeck', label: 'Listening deck' }
	] as const;

	async function submit() {
		if (!fields.sentence.trim() || !fields.translation.trim()) {
			toast.error('Sentence and translation are required.');
			return;
		}
		if (!fields.readingDeck || !fields.productionDeck || !fields.listeningDeck) {
			toast.error('Pick all three decks.');
			return;
		}

		submitting = true;
		try {
			await addSentenceCard({
				decks: [fields.readingDeck, fields.productionDeck, fields.listeningDeck],
				sentence: fields.sentence.trim(),
				translation: fields.translation.trim(),
				reading: fields.reading.trim() || undefined,
				notes: fields.notes.trim() || undefined,
				tags: fields.tagsInput
					.split(',')
					.map((t) => t.trim())
					.filter(Boolean)
			});
			toast.success('Added to Anki');
			open = false;
		} catch {
			toast.error('Failed to add to Anki');
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[85vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Add to Anki</Dialog.Title>
			<Dialog.Description>Review the card before it's written to Anki.</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-4">
			{#if generating}
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<Spinner class="size-4" />
					Generating...
				</div>
			{/if}

			<Field.Field>
				<Field.Label for="sentence">Sentence</Field.Label>
				<Textarea id="sentence" class="min-h-16" bind:value={fields.sentence} />
			</Field.Field>

			<Field.Field>
				<Field.Label for="translation">Translation</Field.Label>
				<Textarea id="translation" class="min-h-16" bind:value={fields.translation} />
			</Field.Field>

			<Field.Field>
				<Field.Label for="reading">Reading</Field.Label>
				<Input id="reading" bind:value={fields.reading} />
			</Field.Field>

			<Field.Field>
				<Field.Label for="notes">Notes</Field.Label>
				<Textarea id="notes" class="min-h-16" bind:value={fields.notes} />
			</Field.Field>

			<Field.Field>
				<Field.Label for="tags">Tags</Field.Label>
				<Input id="tags" placeholder="comma, separated" bind:value={fields.tagsInput} />
			</Field.Field>

			{#each deckSlots as slot (slot.key)}
				<Field.Field>
					<Field.Label for={slot.key}>{slot.label}</Field.Label>
					<Select.Root type="single" bind:value={fields[slot.key]}>
						<Select.Trigger id={slot.key} class="w-full">
							{fields[slot.key] || `Select ${slot.label.toLowerCase()}`}
						</Select.Trigger>
						<Select.Content>
							{#each decks as deck (deck)}
								<Select.Item value={deck} label={deck} />
							{/each}
						</Select.Content>
					</Select.Root>
				</Field.Field>
			{/each}
		</div>

		<Dialog.Footer>
			<Button onclick={submit} isLoading={submitting} disabled={generating}>Add to Anki</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
