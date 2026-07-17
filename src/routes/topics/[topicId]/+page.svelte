<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getTopicById, type Topic } from '$lib/topics.remote';
	import { createSession } from '$lib/agents.remote';
	import { runAgent } from '$lib/sessions.remote';
	import { getAvailableModels } from '$lib/ollamaAdmin.remote';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import TopicStatusBadge from '../topic-status-badge.svelte';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import GraduationCapIcon from '@lucide/svelte/icons/graduation-cap';
	import { formatDateTime } from '$lib/date';
	import { toast } from 'svelte-sonner';

	let { params }: { params: { topicId: string } } = $props();
	const { topicId } = $derived(params);

	const topic = $derived(await getTopicById(topicId));
	const availableModels = $derived(await getAvailableModels());

	let model = $state('');
	const isStarting = $derived(createSession.pending > 0 || runAgent.pending > 0);
	const isStartDisabled = $derived(!model || isStarting);

	const modelTriggerContent = $derived(
		availableModels.find((m) => m.model === model)?.model ?? 'Select a model'
	);

	function buildStudySystemPrompt(topic: Topic): string {
		const lines = [
			`You are studying the topic "${topic.topic}" with the student.`,
			`Current progress status: ${topic.status}.`
		];

		if (topic.notes) {
			lines.push(`Notes so far:\n${topic.notes}`);
		}

		return lines.join('\n\n');
	}

	async function startStudying() {
		if (isStartDisabled) {
			return;
		}

		try {
			const session = await createSession({
				agentId: topic.agentId,
				name: `Studying: ${topic.topic}`,
				model,
				systemPrompt: buildStudySystemPrompt(topic)
			});

			await runAgent({ sessionId: session.id, prompt: `Let's study "${topic.topic}".` });

			await goto(resolve(`/chat/${session.id}`));
		} catch {
			toast.error('Failed to start studying');
		}
	}
</script>

<div class="flex flex-col gap-4 p-2 sm:p-8">
	<a
		href={resolve('/topics')}
		class="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeftIcon class="size-4" />
		Back to topics
	</a>

	<Card.Root>
		<Card.Header>
			<div class="flex items-center justify-between">
				<Card.Title>{topic.topic}</Card.Title>
				<TopicStatusBadge status={topic.status} />
			</div>
			<Card.Description class="flex items-center gap-2">
				<Badge variant="secondary">{topic.agentName}</Badge>
				Updated {formatDateTime(topic.updatedAt)}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if topic.notes}
				<p class="text-sm whitespace-pre-wrap">{topic.notes}</p>
			{:else}
				<p class="text-sm text-muted-foreground">No notes for this topic yet.</p>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Study this topic</Card.Title>
			<Card.Description>
				Starts a new session with {topic.agentName}, primed with this topic's details.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				class="flex flex-col gap-4 sm:flex-row sm:items-end"
				onsubmit={(e) => {
					e.preventDefault();
					startStudying();
				}}
			>
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

				<Button type="submit" disabled={isStartDisabled}>
					{#if isStarting}
						<Spinner />
					{:else}
						<GraduationCapIcon />
						Start studying
					{/if}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
