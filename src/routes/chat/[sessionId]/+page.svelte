<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		getSession,
		getSessionMessagesQuery,
		getStreamingReply,
		runAgent,
		cancelAgent,
		updateSessionModel
	} from '#lib/sessions.remote.js';
	import { getModelOptions } from '#lib/models.remote.js';
	import { encodeModelSelection, decodeModelSelection, type ModelSelection } from '#lib/models.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { ScrollArea } from '#lib/components/ui/scroll-area/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import SquareIcon from '@lucide/svelte/icons/square';
	import ChatMessage from './chat-message.svelte';
	import AnkiSelectionMenu from './anki-selection-menu.svelte';
	import { toast } from 'svelte-sonner';

	let { params }: { params: { sessionId: string } } = $props();
	const { sessionId } = $derived(params);

	const session = $derived(await getSession(sessionId));
	const sessionMessages = $derived(getSessionMessagesQuery(sessionId));
	const streamingReply = $derived(getStreamingReply(sessionId));

	let prompt = $state('');
	let stopping = $state(false);
	let selectionValue = $state(
		encodeModelSelection({
			provider: session.model.provider.name as ModelSelection['provider'],
			name: session.model.name
		})
	);

	const isSending = $derived(runAgent.pending > 0);
	const isGenerating = $derived(
		streamingReply.current !== null && streamingReply.current !== undefined
	);

	const modelGroups = $derived(await getModelOptions());
	const modelTriggerContent = $derived(decodeModelSelection(selectionValue).name);

	async function changeModel(value: string) {
		if (value === selectionValue) return;

		const previous = selectionValue;
		selectionValue = value;
		try {
			await updateSessionModel({ sessionId, model: decodeModelSelection(value) });
		} catch {
			selectionValue = previous;
			toast.error('Failed to change the model');
		}
	}

	async function send() {
		const trimmed = prompt.trim();

		if (!trimmed || isSending) return;

		prompt = '';
		try {
			await runAgent({ sessionId, prompt: trimmed });
		} catch {
			prompt = trimmed;
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
				<Select.Root
					type="single"
					value={selectionValue}
					onValueChange={changeModel}
					disabled={isGenerating}
				>
					<Select.Trigger size="sm" class="w-fit">
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
			</div>
		{/if}
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>{session?.name ?? 'Conversation'}</Card.Title>
		</Card.Header>
		<Card.Content class="flex flex-col gap-4">
			<ScrollArea class="h-[60vh] rounded-md border p-4">
				<AnkiSelectionMenu {sessionId}>
					<div class="flex flex-col gap-4">
						{#if sessionMessages.current === null}
							<div class="flex items-center gap-2 text-sm text-muted-foreground">
								<Spinner class="size-4" />
								Loading...
							</div>
						{:else}
							{#each sessionMessages.current as message (message.id)}
								<ChatMessage {message} />
							{/each}
						{/if}
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
				</AnkiSelectionMenu>
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
