<script lang="ts">
	import { resolve } from '$app/paths';
	import { getStoryById } from '$lib/stories.remote';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import PaperclipIcon from '@lucide/svelte/icons/paperclip';
	import { formatDateTime } from '$lib/date';

	let { params }: { params: { storyId: string } } = $props();
	const { storyId } = $derived(params);

	const story = $derived(await getStoryById(storyId));

	let activeSubjectId = $state(story.content[0]?.subjectId ?? '');
</script>

<div class="flex flex-col gap-4 p-2 sm:p-8">
	<a
		href={resolve('/stories')}
		class="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeftIcon class="size-4" />
		Back to stories
	</a>

	<Card.Root>
		<Card.Header>
			<Card.Title>{story.title}</Card.Title>
			<Card.Description class="flex flex-wrap items-center gap-2">
				{#each story.content as variant (variant.id)}
					<Badge variant="secondary">{variant.subject.name}</Badge>
				{/each}
				Updated {formatDateTime(story.updatedAt)}
			</Card.Description>
		</Card.Header>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Content</Card.Title>
			<Card.Description>One variant per subject it has been saved or translated into.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if story.content.length === 0}
				<p class="text-sm text-muted-foreground">No content saved for this story yet.</p>
			{:else}
				<Tabs.Root bind:value={activeSubjectId}>
					<Tabs.List>
						{#each story.content as variant (variant.id)}
							<Tabs.Trigger value={variant.subjectId}>
								{variant.subject.name}
								{#if variant.stale}
									<Badge variant="destructive">Stale</Badge>
								{/if}
							</Tabs.Trigger>
						{/each}
					</Tabs.List>
					{#each story.content as variant (variant.id)}
						<Tabs.Content value={variant.subjectId} class="flex flex-col gap-2">
							<span class="text-xs text-muted-foreground">
								Updated {formatDateTime(variant.updatedAt)}
							</span>
							<p class="text-sm whitespace-pre-wrap">{variant.content}</p>
						</Tabs.Content>
					{/each}
				</Tabs.Root>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Resources</Card.Title>
			<Card.Description>Original source material attached to this story.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if story.resources.length === 0}
				<p class="text-sm text-muted-foreground">No resources attached to this story yet.</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each story.resources as resource (resource.id)}
						<li>
							<a
								href={resolve(`/files/${resource.fileId}`)}
								target="_blank"
								rel="noopener noreferrer"
								class="flex w-fit items-center gap-2 text-sm text-foreground hover:text-primary hover:underline"
							>
								<PaperclipIcon class="size-4 text-muted-foreground" />
								{resource.label ?? resource.file.path}
								<span class="text-xs text-muted-foreground">{resource.file.mimeType}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
