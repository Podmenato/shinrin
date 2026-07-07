<script lang="ts">
	import { runAgent } from '$lib/sessions.remote';
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';
	import { renderMarkdown } from '$lib/markdown';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

	type Message = PageData['messages'][0];

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	let messages = $state<Message[]>(data.messages.filter((m) => m.role !== 'system'));
	let input = $state('');
	let running = $state(false);
	let chatEl = $state<HTMLElement | null>(null);

	$effect(() => {
		if (messages.length) chatEl?.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
	});

	async function send() {
		if (!input.trim() || running) return;
		const prompt = input.trim();
		input = '';
		running = true;

		messages.push({
			id: crypto.randomUUID(),
			sessionId: data.session.id,
			role: 'user',
			content: prompt,
			toolName: null,
			createdAt: new Date()
		});

		const response = await runAgent({ sessionId: data.session.id, prompt });

		messages.push({
			id: crypto.randomUUID(),
			sessionId: data.session.id,
			role: 'assistant',
			content: response,
			toolName: null,
			createdAt: new Date()
		});

		running = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}
</script>

<div class="flex h-screen flex-col bg-background text-foreground">
	<!-- Header -->
	<header class="flex items-center gap-4 border-b border-border px-6 py-4">
		<Button href={resolve('/')} variant="ghost" size="icon">
			<ArrowLeftIcon />
		</Button>
		<div>
			<h1 class="font-semibold">{data.session.name}</h1>
			<p class="text-xs text-muted-foreground">{data.session.agent.name} · {data.session.model}</p>
		</div>
	</header>

	<!-- Messages -->
	<div bind:this={chatEl} class="flex-1 overflow-y-auto px-4 py-6">
		<div class="mx-auto max-w-2xl space-y-4">
			{#if messages.filter((m) => m.role === 'user' || m.role === 'assistant').length === 0}
				<p class="text-center text-sm text-muted-foreground">Send a message to start the session.</p>
			{/if}

			{#each messages as message (message.id)}
				{#if message.role === 'user'}
					<div class="flex justify-end">
						<div class="max-w-[75%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground">
							{message.content}
						</div>
					</div>
				{:else if message.role === 'assistant'}
					<div class="flex justify-start">
						<div
							class="prose prose-sm prose-invert max-w-[75%] rounded-2xl rounded-tl-sm bg-muted px-4 py-3 leading-relaxed prose-p:my-2 prose-pre:bg-background prose-table:text-xs prose-th:border prose-th:border-border prose-td:border prose-td:border-border"
						>
							{@html renderMarkdown(message.content)}
						</div>
					</div>
				{:else if message.role === 'tool'}
					<div class="flex justify-center">
						<Badge variant="secondary">tool: {message.toolName}</Badge>
					</div>
				{/if}
			{/each}

			{#if running}
				<div class="flex justify-start">
					<div class="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
						<Spinner />
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Input -->
	<div class="border-t border-border px-4 py-4">
		<div class="mx-auto flex max-w-2xl gap-3">
			<Textarea
				bind:value={input}
				onkeydown={onKeydown}
				disabled={running}
				placeholder="Message… (Enter to send, Shift+Enter for newline)"
				rows={1}
				class="flex-1 resize-none"
			/>
			<Button onclick={send} disabled={running || !input.trim()}>Send</Button>
		</div>
	</div>
</div>
