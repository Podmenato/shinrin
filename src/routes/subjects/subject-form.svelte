<script lang="ts">
	import { saveSubject, type Subject } from '#lib/subjects.remote.js';
	import { getDecks } from '#lib/anki.remote.js';
	import { getAgents } from '#lib/agents.remote.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { toast } from 'svelte-sonner';
	import { formatDateTime } from '#lib/date.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	const { subject }: { subject?: Subject } = $props();

	// Decks can fail when Anki is turned off — same pattern as quick-ask-form.svelte's decksQuery.
	const decksQuery = getDecks();
	const decks = $derived(decksQuery.current ?? []);
	const allAgents = $derived(await getAgents());

	let name = $derived(subject?.name ?? '');
	let readingDeck = $derived(subject?.readingDeck ?? '');
	let productionDeck = $derived(subject?.productionDeck ?? '');
	let listeningDeck = $derived(subject?.listeningDeck ?? '');
	let autoAddAgentId = $derived(subject?.autoAddAgentId ?? '');

	const DECK_SLOT_NAMES = { R: 'Reading', P: 'Production', L: 'Listening' } as const;

	function buildOptionLabel(slot: 'R' | 'P' | 'L') {
		const subjectName = name.trim() || 'Subject';
		return `Auto-generate (${subjectName}::${DECK_SLOT_NAMES[slot]})`;
	}

	function getDeckTriggerContent(value: string, slot: 'R' | 'P' | 'L') {
		return value === '' ? buildOptionLabel(slot) : value;
	}

	const readingDeckTriggerContent = $derived(getDeckTriggerContent(readingDeck, 'R'));
	const productionDeckTriggerContent = $derived(getDeckTriggerContent(productionDeck, 'P'));
	const listeningDeckTriggerContent = $derived(getDeckTriggerContent(listeningDeck, 'L'));

	const agentTriggerContent = $derived(
		autoAddAgentId === ''
			? 'Auto-generate a new agent'
			: (allAgents.find((a) => a.id === autoAddAgentId)?.name ?? 'Select an agent')
	);

	const subjectForm = $derived(subject ? saveSubject.for(subject.id) : saveSubject);
	const submitForm = $derived(
		subjectForm.enhance(async (form) => {
			const success = await form.submit();
			if (success) {
				for (const warning of form.result?.deckWarnings ?? []) {
					toast.warning(warning);
				}
				if (subject) {
					toast.success('Subject saved');
				} else {
					toast.success('Subject created');
					await goto(
						resolve('/subjects/[subjectId]', { subjectId: form.result?.subject?.id ?? '' })
					);
				}
			} else {
				toast.error('Saving failed');
			}
		})
	);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{subject?.name ?? 'New subject'}</Card.Title>
		<Card.Description>
			{#if subject}
				Created {formatDateTime(subject.createdAt)} · Updated {formatDateTime(subject.updatedAt)}
			{:else}
				Add a new study subject.
			{/if}
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<form {...submitForm} class="flex flex-col gap-4">
			{#if subject}
				<input {...subjectForm.fields.id.as('hidden', subject.id)} />
			{/if}

			<Field.Field>
				<Field.Label for="name">Name</Field.Label>
				<Input
					id="name"
					{...subjectForm.fields.name.as('text', subject?.name ?? '')}
					bind:value={name}
				/>
				<Field.Error errors={subjectForm.fields.name.issues()} />
			</Field.Field>

			<Field.Field>
				<Field.Label for="description">Description</Field.Label>
				<Textarea
					id="description"
					class="min-h-32"
					{...subjectForm.fields.description.as('text', subject?.description ?? '')}
				/>
				<Field.Error errors={subjectForm.fields.description.issues()} />
			</Field.Field>

			{#if decksQuery.error}
				<p class="text-sm text-destructive">
					Couldn't reach Anki — make sure it's running with AnkiConnect installed. Existing decks
					won't be listed below, but auto-generate is still available.
				</p>
			{/if}

			<Field.Field>
				<Field.Label for="readingDeck">Reading deck</Field.Label>
				<Select.Root
					type="single"
					name={subjectForm.fields.readingDeck.as('hidden', '').name}
					bind:value={readingDeck}
				>
					<Select.Trigger id="readingDeck" class="w-full">
						{readingDeckTriggerContent}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="" label={buildOptionLabel('R')} />
						{#each decks as deck (deck)}
							<Select.Item value={deck} label={deck} />
						{/each}
					</Select.Content>
				</Select.Root>
			</Field.Field>

			<Field.Field>
				<Field.Label for="productionDeck">Production deck</Field.Label>
				<Select.Root
					type="single"
					name={subjectForm.fields.productionDeck.as('hidden', '').name}
					bind:value={productionDeck}
				>
					<Select.Trigger id="productionDeck" class="w-full">
						{productionDeckTriggerContent}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="" label={buildOptionLabel('P')} />
						{#each decks as deck (deck)}
							<Select.Item value={deck} label={deck} />
						{/each}
					</Select.Content>
				</Select.Root>
			</Field.Field>

			<Field.Field>
				<Field.Label for="listeningDeck">Listening deck</Field.Label>
				<Select.Root
					type="single"
					name={subjectForm.fields.listeningDeck.as('hidden', '').name}
					bind:value={listeningDeck}
				>
					<Select.Trigger id="listeningDeck" class="w-full">
						{listeningDeckTriggerContent}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="" label={buildOptionLabel('L')} />
						{#each decks as deck (deck)}
							<Select.Item value={deck} label={deck} />
						{/each}
					</Select.Content>
				</Select.Root>
			</Field.Field>

			<Field.Field>
				<Field.Label for="autoAddAgentId">Default automatic-add agent</Field.Label>
				<Select.Root
					type="single"
					name={subjectForm.fields.autoAddAgentId.as('hidden', '').name}
					bind:value={autoAddAgentId}
				>
					<Select.Trigger id="autoAddAgentId" class="w-full">
						{agentTriggerContent}
					</Select.Trigger>
					<Select.Content>
						{#if !subject}
							<Select.Item value="" label="Auto-generate a new agent" />
						{/if}
						{#each allAgents as agent (agent.id)}
							<Select.Item value={agent.id} label={agent.name} />
						{/each}
					</Select.Content>
				</Select.Root>
				<Field.Error errors={subjectForm.fields.autoAddAgentId.issues()} />
			</Field.Field>

			<div class="flex items-center justify-end gap-2">
				<Button
					type="submit"
					disabled={subjectForm.pending > 0}
					isLoading={subjectForm.pending > 0}
				>
					{subject ? 'Save' : 'Create'}
				</Button>
			</div>
		</form>
	</Card.Content>
</Card.Root>
