<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		getSession,
		getSessionMessages,
		getStreamingReply,
		runAgent,
		cancelAgent
	} from '#lib/sessions.remote.js';
	import { generateSentenceCard } from '#lib/chatAnki.remote.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as ContextMenu from '#lib/components/ui/context-menu/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { ScrollArea } from '#lib/components/ui/scroll-area/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import SquareIcon from '@lucide/svelte/icons/square';
	import ChatMessage from './chat-message.svelte';
	import AddToAnkiDialog, { type CardFields } from './add-to-anki-dialog.svelte';
	import { toast } from 'svelte-sonner';

	let { params }: { params: { sessionId: string } } = $props();
	const { sessionId } = $derived(params);

	const session = $derived(await getSession(sessionId));
	const sessionMessages = $derived(getSessionMessages(sessionId));
	const streamingReply = $derived(getStreamingReply(sessionId));

	let prompt = $state('');
	let stopping = $state(false);
	// TODO: context actions will be redone, review if this still makes sense after
	let hasSelection = $state(false);

	function updateSelectionState() {
		hasSelection = (window.getSelection()?.toString().trim().length ?? 0) > 0;
	}

	function currentSelection() {
		const selection = window.getSelection();
		const selectedText = selection?.toString().trim() ?? '';
		const anchorNode = selection?.anchorNode ?? null;
		const anchorEl = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
		const messageContent = anchorEl?.closest('[data-chat-message]')?.textContent?.trim();
		return { selectedText, messageContent: messageContent ?? selectedText };
	}

	function emptyCardFields(): CardFields {
		return {
			sentence: '',
			translation: '',
			reading: '',
			notes: '',
			tagsInput: '',
			readingDeck: '',
			productionDeck: '',
			listeningDeck: ''
		};
	}

	let ankiDialogOpen = $state(false);
	let ankiGenerating = $state(false);
	let ankiFields = $state(emptyCardFields());
	const canGenerateCard = $derived(!!session?.agent.subject);

	function addToAnkiManually() {
		const { selectedText } = currentSelection();
		ankiFields = { ...emptyCardFields(), sentence: selectedText };
		ankiDialogOpen = true;
	}

	async function addToAnkiWithAi() {
		const { selectedText, messageContent } = currentSelection();
		ankiFields = emptyCardFields();
		ankiDialogOpen = true;
		ankiGenerating = true;
		try {
			const result = await generateSentenceCard({ sessionId, selectedText, messageContent });
			ankiFields.sentence = result.sentence;
			ankiFields.translation = result.translation;
			ankiFields.reading = result.reading;
			ankiFields.notes = result.notes;
		} catch {
			toast.error('Failed to generate sentence');
		} finally {
			ankiGenerating = false;
		}
	}
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
		} finally {
			stopping = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	async function cancel() {
		stopping = true;
		try {
			await cancelAgent(sessionId);
		} catch {
			toast.error('Failed to cancel');
			stopping = false;
		}
	}
</script>

<svelte:document onselectionchange={updateSelectionState} />

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
				<ContextMenu.Root>
					<ContextMenu.Trigger disabled={!hasSelection} class="contents select-text">
						<div class="flex flex-col gap-4">
							{#each sessionMessages.current ?? [] as message (message.id)}
								<ChatMessage {message} />
							{/each}
							{#if isGenerating}
								{#if streamingReply.current}
									<ChatMessage
										message={{
											role: 'assistant',
											content: streamingReply.current,
											toolCalls: []
										}}
									/>
								{:else}
									<div class="flex items-center gap-2 text-sm text-muted-foreground">
										<Spinner class="size-4" />
										Thinking...
									</div>
								{/if}
							{/if}
						</div>
					</ContextMenu.Trigger>
					<ContextMenu.Content>
						<ContextMenu.Item onSelect={addToAnkiManually}>Add to Anki</ContextMenu.Item>
						<ContextMenu.Item onSelect={addToAnkiWithAi} disabled={!canGenerateCard}>
							Add to Anki (AI)
						</ContextMenu.Item>
					</ContextMenu.Content>
				</ContextMenu.Root>
			</ScrollArea>

			{#if stopping}
				<p class="text-sm text-muted-foreground">Stopping…</p>
			{/if}

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
				{#if isSending}
					<Button
						type="button"
						variant="destructive"
						size="icon"
						isLoading={stopping}
						onclick={cancel}
						aria-label="Cancel"
					>
						<SquareIcon class="size-4 fill-current" />
					</Button>
				{/if}
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

<AddToAnkiDialog bind:open={ankiDialogOpen} fields={ankiFields} generating={ankiGenerating} />
