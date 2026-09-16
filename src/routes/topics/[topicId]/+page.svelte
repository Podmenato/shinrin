<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getTopicById, type Topic } from '#lib/topics.remote.js';
	import { createSession, getAgentsForSubject } from '#lib/agents.remote.js';
	import { runAgent } from '#lib/sessions.remote.js';
	import { getModelOptions } from '#lib/models.remote.js';
	import { encodeModelSelection, decodeModelSelection } from '#lib/models.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import TopicStatusBadge from '../topic-status-badge.svelte';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import GraduationCapIcon from '@lucide/svelte/icons/graduation-cap';
	import { formatDateTime } from '#lib/date.js';
	import { toast } from 'svelte-sonner';

	let { params }: { params: { topicId: string } } = $props();
	const { topicId } = $derived(params);

	const topic = $derived(await getTopicById(topicId));
	const modelGroups = $derived(await getModelOptions());
	const agents = $derived(await getAgentsForSubject(topic.subjectId));

	let agentId = $state('');
	let selectionValue = $state('');
	const isStarting = $derived(createSession.pending > 0);
	const isStartDisabled = $derived(!agentId || !selectionValue || isStarting);

	const agentTriggerContent = $derived(
		agents.find((a) => a.id === agentId)?.name ?? 'Select an agent'
	);
	const modelTriggerContent = $derived(
		selectionValue ? decodeModelSelection(selectionValue).name : 'Select a model'
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
				agentId,
				name: `Studying: ${topic.topic}`,
				model: decodeModelSelection(selectionValue),
				systemPrompt: buildStudySystemPrompt(topic)
			});

			runAgent({ sessionId: session.id, prompt: `Let's study "${topic.topic}".` }).catch(() => {
				toast.error('Failed to send message');
			});

			await goto(resolve('/chat/[sessionId]', { sessionId: session.id }));
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
				<Badge variant="secondary">{topic.subjectName}</Badge>
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
			<Card.Description>Pick an agent and model, primed with this topic's details.</Card.Description
			>
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
					<Select.Root type="single" name="model" bind:value={selectionValue}>
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
				</Field.Field>

				<Button type="submit" disabled={isStartDisabled} isLoading={isStarting}>
					<GraduationCapIcon />
					Start studying
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
