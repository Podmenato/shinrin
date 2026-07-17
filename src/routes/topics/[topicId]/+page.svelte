<script lang="ts">
	import { resolve } from '$app/paths';
	import { getTopicById } from '$lib/topics.remote';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import TopicStatusBadge from '../topic-status-badge.svelte';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import { formatDateTime } from '$lib/date';

	let { params }: { params: { topicId: string } } = $props();
	const { topicId } = $derived(params);

	const topic = $derived(await getTopicById(topicId));
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
				<p class="whitespace-pre-wrap text-sm">{topic.notes}</p>
			{:else}
				<p class="text-sm text-muted-foreground">No notes for this topic yet.</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
