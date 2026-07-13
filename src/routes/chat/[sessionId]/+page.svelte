<script lang="ts">
	import { resolve } from '$app/paths';
	import { getSession, getSessionMessages, runAgent } from '$lib/sessions.remote';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChatMessage from './chat-message.svelte';

	let { params }: { params: { sessionId: string } } = $props();
	const { sessionId } = $derived(params);

	const session = $derived(getSession(sessionId));
	const sessionMessages = $derived(getSessionMessages(sessionId));

	let prompt = $state('');
	const isSending = $derived(runAgent.pending > 0);

	async function send() {
		const trimmed = prompt.trim();

		if (!trimmed || isSending) return;

		await runAgent({ sessionId, prompt: trimmed });
		prompt = '';
	}
</script>

<div class="flex flex-col gap-4 p-2 sm:p-8">
	<div class="flex items-center justify-between">
		<a
			href={resolve('/chat')}
			class="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeftIcon class="size-4" />
			Back to chat
		</a>
		{#if session.current}
			<div class="flex items-center gap-2">
				<Badge variant="secondary">{session.current.agent.name}</Badge>
				<Badge variant="outline">{session.current.model}</Badge>
			</div>
		{/if}
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>{session.current?.name ?? 'Conversation'}</Card.Title>
		</Card.Header>
		<Card.Content class="flex flex-col gap-4">
			<ScrollArea class="h-[60vh] rounded-md border p-4">
				<div class="flex flex-col gap-4">
					{#each sessionMessages.current ?? [] as message (message.id)}
						<ChatMessage {message} />
					{/each}
				</div>
			</ScrollArea>

			<form
				class="flex gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					send();
				}}
			>
				<Textarea
					class="min-h-0 flex-1 resize-none"
					rows={1}
					placeholder="Message..."
					disabled={isSending}
					bind:value={prompt}
				/>
				<Button type="submit" disabled={isSending || prompt.trim() === ''}>
					{#if isSending}
						<Spinner />
					{:else}
						Send
					{/if}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
