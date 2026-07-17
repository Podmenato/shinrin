<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getMistakeById, type Mistake } from '$lib/mistakes.remote';
	import { createSession, getAgentsForSubject } from '$lib/agents.remote';
	import { runAgent } from '$lib/sessions.remote';
	import { getAvailableModels } from '$lib/ollamaAdmin.remote';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import { formatDateTime } from '$lib/date';
	import { toast } from 'svelte-sonner';

	let { params }: { params: { mistakeId: string } } = $props();
	const { mistakeId } = $derived(params);

	const mistake = $derived(await getMistakeById(mistakeId));
	const availableModels = $derived(await getAvailableModels());
	const agents = $derived(await getAgentsForSubject(mistake.subjectId));

	let agentId = $state('');
	let model = $state('');
	const isStarting = $derived(createSession.pending > 0 || runAgent.pending > 0);
	const isStartDisabled = $derived(!agentId || !model || isStarting);

	const agentTriggerContent = $derived(
		agents.find((a) => a.id === agentId)?.name ?? 'Select an agent'
	);
	const modelTriggerContent = $derived(
		availableModels.find((m) => m.model === model)?.model ?? 'Select a model'
	);

	function buildMistakeSystemPrompt(mistake: Mistake): string {
		return (
			`You are helping the student work on a mistake they made: "${mistake.title}".\n\n` +
			`Details: ${mistake.note}`
		);
	}

	async function startConversation() {
		if (isStartDisabled) {
			return;
		}

		try {
			const session = await createSession({
				agentId,
				name: `Reviewing: ${mistake.title}`,
				model,
				systemPrompt: buildMistakeSystemPrompt(mistake)
			});

			await runAgent({
				sessionId: session.id,
				prompt: `Let's go over the mistake "${mistake.title}".`
			});

			await goto(resolve(`/chat/${session.id}`));
		} catch {
			toast.error('Failed to start conversation');
		}
	}
</script>

<div class="flex flex-col gap-4 p-2 sm:p-8">
	<a
		href={resolve('/mistakes')}
		class="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeftIcon class="size-4" />
		Back to mistakes
	</a>

	<Card.Root>
		<Card.Header>
			<Card.Title>{mistake.title}</Card.Title>
			<Card.Description class="flex items-center gap-2">
				<Badge variant="secondary">{mistake.subjectName}</Badge>
				Observed {formatDateTime(mistake.createdAt)}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<p class="text-sm whitespace-pre-wrap">{mistake.note}</p>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Start a conversation</Card.Title>
			<Card.Description
				>Pick an agent and model, primed with this mistake's details.</Card.Description
			>
		</Card.Header>
		<Card.Content>
			<form
				class="flex flex-col gap-4 sm:flex-row sm:items-end"
				onsubmit={(e) => {
					e.preventDefault();
					startConversation();
				}}
			>
				<Field.Field class="sm:max-w-xs">
					<Field.Label for="agent">Agent</Field.Label>
					<Select.Root type="single" name="agentId" bind:value={agentId}>
						<Select.Trigger id="agent" class="w-full">
							{agentTriggerContent}
						</Select.Trigger>
						<Select.Content>
							{#each agents as availableAgent (availableAgent.id)}
								<Select.Item value={availableAgent.id} label={availableAgent.name} />
							{/each}
						</Select.Content>
					</Select.Root>
				</Field.Field>

				<Field.Field class="sm:max-w-xs">
					<Field.Label for="model">Model</Field.Label>
					<Select.Root type="single" name="model" bind:value={model}>
						<Select.Trigger id="model" class="w-full">
							{modelTriggerContent}
						</Select.Trigger>
						<Select.Content>
							{#each availableModels as availableModel (availableModel.model)}
								<Select.Item value={availableModel.model} label={availableModel.model} />
							{/each}
						</Select.Content>
					</Select.Root>
				</Field.Field>

				<Button type="submit" disabled={isStartDisabled} isLoading={isStarting}>
					<MessageSquareIcon />
					Start conversation
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
