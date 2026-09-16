<script lang="ts">
	import { saveQuickAsk, getQuickAskById } from '#lib/quickAsks.remote.js';
	import { getAgents } from '#lib/agents.remote.js';
	import { getModelOptions } from '#lib/models.remote.js';
	import { encodeModelSelection, decodeModelSelection, type ModelSelection } from '#lib/models.js';
	import { getDecks, getCardStates } from '#lib/anki.remote.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import DeleteQuickAskAction from './[quickAskId]/delete-quick-ask-action.svelte';
	import { formatDateTime } from '#lib/date.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { isHttpError } from '@sveltejs/kit';
	import { toast } from 'svelte-sonner';

	const { quickAsk }: { quickAsk?: Awaited<ReturnType<typeof getQuickAskById>> } = $props();

	const allAgents = $derived(await getAgents());
	const modelGroups = $derived(await getModelOptions());
	const cardStates = $derived(await getCardStates());

	// Get decks can fail when anki is turned off
	const decksQuery = getDecks();
	const decks = $derived(decksQuery.current ?? (quickAsk?.deck ? [quickAsk.deck] : []));

	let agentId = $derived(quickAsk?.agentId ?? '');
	let selectionValue = $derived(
		quickAsk
			? encodeModelSelection({
					provider: quickAsk.model.provider.name as ModelSelection['provider'],
					name: quickAsk.model.name
				})
			: ''
	);
	let deck = $derived(quickAsk?.deck ?? '');
	let cardState = $derived(quickAsk?.state ?? '');

	const selection = $derived(selectionValue ? decodeModelSelection(selectionValue) : null);

	const agentTriggerContent = $derived(
		allAgents.find((a) => a.id === agentId)?.name ?? 'Select an agent'
	);
	const modelTriggerContent = $derived(selection?.name ?? 'Select a model');
	const deckTriggerContent = $derived(deck || 'Select a deck');
	const stateTriggerContent = $derived(cardState || 'Select a state');

	const quickAskForm = $derived(quickAsk ? saveQuickAsk.for(quickAsk.id) : saveQuickAsk);
	const submitForm = $derived(
		quickAskForm.enhance(async (form) => {
			try {
				const success = await form.submit();
				if (success) {
					if (quickAsk) {
						toast.success('Quick ask saved');
					} else {
						toast.success('Quick ask created');
						form.element.reset();
						await goto(resolve('/quick-asks/[quickAskId]', { quickAskId: form.result?.id ?? '' }));
					}
				} else {
					toast.error('Saving failed');
				}
			} catch (e) {
				toast.error(isHttpError(e) ? e.body.message : 'Saving failed');
			}
		})
	);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{quickAsk?.name ?? 'New quick ask'}</Card.Title>
		<Card.Description>
			{#if quickAsk}
				Created {formatDateTime(quickAsk.createdAt)} · Updated {formatDateTime(quickAsk.updatedAt)}
			{:else}
				Pre-fetches matching cards from a deck and pastes them straight into the prompt, skipping
				the agent's own find/cards_info round trip.
			{/if}
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<form {...submitForm} class="flex flex-col gap-4">
			{#if quickAsk}
				<input {...quickAskForm.fields.id.as('hidden', quickAsk.id)} />
			{/if}

			<Field.Field>
				<Field.Label for="name">Name</Field.Label>
				<Input id="name" {...quickAskForm.fields.name.as('text', quickAsk?.name ?? '')} />
				<Field.Error errors={quickAskForm.fields.name.issues()} />
			</Field.Field>

			<div class="grid gap-4 sm:grid-cols-2">
				<Field.Field>
					<Field.Label for="agentId">Agent</Field.Label>
					<Select.Root
						type="single"
						name={quickAskForm.fields.agentId.as('hidden', '').name}
						bind:value={agentId}
					>
						<Select.Trigger id="agentId" class="w-full">
							{agentTriggerContent}
						</Select.Trigger>
						<Select.Content>
							{#each allAgents as agent (agent.id)}
								<Select.Item value={agent.id} label={agent.name} />
							{/each}
						</Select.Content>
					</Select.Root>
					<Field.Error errors={quickAskForm.fields.agentId.issues()} />
				</Field.Field>

				<Field.Field>
					<Field.Label for="model">Model</Field.Label>
					<Select.Root type="single" bind:value={selectionValue}>
						<Select.Trigger id="model" class="w-full">
							{modelTriggerContent}
						</Select.Trigger>
						<Select.Content>
							{#each modelGroups as group (group.provider)}
								<Select.Group>
									<Select.GroupHeading>{group.provider}</Select.GroupHeading>
									{#each group.models as name (name)}
										<Select.Item
											value={encodeModelSelection({ provider: group.provider, name })}
											label={name}
										/>
									{/each}
								</Select.Group>
							{/each}
						</Select.Content>
					</Select.Root>
					<input
						type="hidden"
						name={quickAskForm.fields.model.provider.as('hidden', '').name}
						value={selection?.provider ?? ''}
					/>
					<input
						type="hidden"
						name={quickAskForm.fields.model.name.as('hidden', '').name}
						value={selection?.name ?? ''}
					/>
					<Field.Error errors={quickAskForm.fields.model.issues()} />
				</Field.Field>
			</div>

			<div class="grid gap-4 sm:grid-cols-3">
				<Field.Field>
					<Field.Label for="deck">Deck</Field.Label>
					<Select.Root
						type="single"
						name={quickAskForm.fields.deck.as('hidden', '').name}
						bind:value={deck}
					>
						<Select.Trigger id="deck" class="w-full">
							{deckTriggerContent}
						</Select.Trigger>
						<Select.Content>
							{#each decks as deckName (deckName)}
								<Select.Item value={deckName} label={deckName} />
							{/each}
						</Select.Content>
					</Select.Root>
					{#if decksQuery.error}
						<p class="text-sm text-destructive">
							Couldn't reach Anki — make sure it's running with AnkiConnect installed.
						</p>
					{/if}
					<Field.Error errors={quickAskForm.fields.deck.issues()} />
				</Field.Field>

				<Field.Field>
					<Field.Label for="state">State</Field.Label>
					<Select.Root
						type="single"
						name={quickAskForm.fields.state.as('hidden', '').name}
						bind:value={cardState}
					>
						<Select.Trigger id="state" class="w-full">
							{stateTriggerContent}
						</Select.Trigger>
						<Select.Content>
							{#each cardStates as stateOption (stateOption)}
								<Select.Item value={stateOption} label={stateOption} />
							{/each}
						</Select.Content>
					</Select.Root>
					<Field.Error errors={quickAskForm.fields.state.issues()} />
				</Field.Field>

				<Field.Field>
					<Field.Label for="days">Added within (days)</Field.Label>
					<Input
						id="days"
						placeholder="Any time"
						{...quickAskForm.fields.days.as('text', quickAsk?.days?.toString() ?? '')}
					/>
					<Field.Error errors={quickAskForm.fields.days.issues()} />
				</Field.Field>
			</div>

			<Field.Field>
				<Field.Label for="prompt">Prompt</Field.Label>
				<Textarea
					id="prompt"
					class="min-h-32"
					placeholder="e.g. Give me an example sentence for each of these words."
					{...quickAskForm.fields.prompt.as('text', quickAsk?.prompt ?? '')}
				/>
				<Field.Error errors={quickAskForm.fields.prompt.issues()} />
			</Field.Field>

			<div class="flex items-center justify-end gap-2">
				{#if quickAsk}
					<DeleteQuickAskAction quickAskId={quickAsk.id} />
				{/if}
				<Button
					type="submit"
					disabled={quickAskForm.pending > 0}
					isLoading={quickAskForm.pending > 0}
				>
					{quickAsk ? 'Save' : 'Create'}
				</Button>
			</div>
		</form>
	</Card.Content>
</Card.Root>
