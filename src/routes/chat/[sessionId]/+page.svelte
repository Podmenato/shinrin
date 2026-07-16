<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		getSession,
		getSessionMessages,
		getStreamingReply,
		runAgent
	} from '$lib/sessions.remote';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChatMessage from './chat-message.svelte';
	import { toast } from 'svelte-sonner';

	let { params }: { params: { sessionId: string } } = $props();
	const { sessionId } = $derived(params);

	const session = $derived(await getSession(sessionId));
	const sessionMessages = $derived(getSessionMessages(sessionId));
	const streamingReply = $derived(getStreamingReply(sessionId));

	let prompt = $state('');
	const isSending = $derived(runAgent.pending > 0);
	const isGenerating = $derived(
		streamingReply.current !== null && streamingReply.current !== undefined
	);

	// TODO: workaround for `getSessionMessages` being a plain `query()` — its single-flight
	// refresh from `runAgent` only reaches the tab that called it, so a reload or a second tab
	// never sees the final message otherwise. See the TODO on `getSessionMessages` in
	// sessions.remote.ts for the proper fix (make it a `query.live()`).
	let wasGenerating = false;
	$effect(() => {
		if (wasGenerating && !isGenerating) {
			sessionMessages.refresh();
		}
		wasGenerating = isGenerating;
	});

	async function send() {
		const trimmed = prompt.trim();

		if (!trimmed || isSending) return;

		try {
			await runAgent({ sessionId, prompt: trimmed });
			prompt = '';
		} catch {
			toast.error('Failed to send message');
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
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
		{#if session}
			<div class="flex items-center gap-2">
				<Badge variant="secondary">{session.agent.name}</Badge>
				<Badge variant="outline">{session.model}</Badge>
			</div>
		{/if}
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>{session?.name ?? 'Conversation'}</Card.Title>
		</Card.Header>
		<Card.Content class="flex flex-col gap-4">
			<ScrollArea class="h-[60vh] rounded-md border p-4">
				<div class="flex flex-col gap-4">
					{#each sessionMessages.current ?? [] as message (message.id)}
						<ChatMessage {message} />
					{/each}
					{#if isGenerating}
						{#if streamingReply.current}
							<ChatMessage
								message={{ role: 'assistant', content: streamingReply.current, toolCalls: [] }}
							/>
						{:else}
							<div class="flex items-center gap-2 text-sm text-muted-foreground">
								<Spinner class="size-4" />
								Thinking...
							</div>
						{/if}
					{/if}
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
					onkeydown={handleKeydown}
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
