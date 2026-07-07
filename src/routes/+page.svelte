<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getAgents, getAllSessions, createSession } from '$lib/agents.remote';
	import { getModels } from '$lib/models.remote';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';

	let selectedAgentId = $state<string | undefined>(undefined);
	let modelsPromise = $state<Promise<string[]> | null>(null);
	let showNewSession = $state(false);
	let newSessionName = $state('');
	let newSessionModel = $state<string | undefined>(undefined);
	let creating = $state(false);

	$effect(() => {
		selectedAgentId;
		showNewSession = false;
		newSessionModel = undefined;
		modelsPromise = selectedAgentId ? getModels() : null;
	});

	async function handleCreateSession() {
		if (!selectedAgentId || !newSessionName.trim() || !newSessionModel) return;
		creating = true;
		const session = await createSession({
			agentId: selectedAgentId,
			name: newSessionName.trim(),
			model: newSessionModel
		});
		await goto(resolve(`/chat/${session.id}`));
	}
</script>

<div class="min-h-screen bg-background text-foreground">
	<div class="mx-auto max-w-3xl px-4 py-16">
		<h1 class="mb-2 text-3xl font-bold tracking-tight">Shinrin</h1>
		<p class="mb-12 text-muted-foreground">Your language study assistant.</p>

		<!-- Agent selection -->
		<section class="mb-10">
			<h2 class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
				Select agent
			</h2>
			<ToggleGroup.Root
				type="single"
				bind:value={selectedAgentId}
				variant="outline"
				class="grid w-full grid-cols-2 gap-3"
			>
				{#each await getAgents() as agent (agent.id)}
					<ToggleGroup.Item
						value={agent.id}
						class="h-auto flex-col items-start gap-1 px-6 py-5 text-left"
					>
						<span class="text-lg font-medium">{agent.name}</span>
					</ToggleGroup.Item>
				{/each}
			</ToggleGroup.Root>
		</section>

		<!-- Sessions -->
		<section>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
					Sessions
				</h2>
				<Button
					size="sm"
					onclick={() => (showNewSession = !showNewSession)}
					disabled={!selectedAgentId}
					title={selectedAgentId ? '' : 'Select an agent first'}
				>
					New session
				</Button>
			</div>

			<!-- New session form -->
			{#if showNewSession && selectedAgentId && modelsPromise}
				<Card class="mb-4">
					<CardContent class="space-y-4">
						<Field.Field>
							<Field.Label for="session-name">Name</Field.Label>
							<Input
								id="session-name"
								bind:value={newSessionName}
								placeholder="e.g. JLPT N2 grammar"
							/>
						</Field.Field>

						<Field.Field>
							<Field.Label for="model-select">Model</Field.Label>
							<Select.Root type="single" bind:value={newSessionModel}>
								<Select.Trigger id="model-select" class="w-full">
									{newSessionModel ?? 'Choose a model'}
								</Select.Trigger>
								<Select.Content>
									{#each await modelsPromise as model (model)}
										<Select.Item value={model} label={model} />
									{/each}
								</Select.Content>
							</Select.Root>
						</Field.Field>

						<Button onclick={handleCreateSession} disabled={creating || !newSessionName.trim()}>
							{#if creating}
								<Spinner />
							{/if}
							{creating ? 'Creating…' : 'Start'}
						</Button>
					</CardContent>
				</Card>
			{/if}

			<!-- Session list -->
			{#each await getAllSessions() as session (session.id)}
				<a href={resolve(`/chat/${session.id}`)} class="mb-2 block">
					<Card class="flex-row items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/50">
						<span class="font-medium">{session.name}</span>
						<span class="text-sm text-muted-foreground">{session.agentName} · {session.model}</span>
					</Card>
				</a>
			{:else}
				<Empty.Root>
					<Empty.Content>
						<Empty.Title>No sessions yet</Empty.Title>
						<Empty.Description>Select an agent and start a new session.</Empty.Description>
					</Empty.Content>
				</Empty.Root>
			{/each}
		</section>
	</div>
</div>
