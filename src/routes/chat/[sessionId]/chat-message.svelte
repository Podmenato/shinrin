<script lang="ts">
	import { renderMarkdown } from '$lib/markdown';
	import type { Message } from '$lib/server/contextManager';

	const { message }: { message: Message } = $props();
</script>

{#if message.role === 'user'}
	<div class="ml-auto max-w-[75%] rounded-2xl bg-primary px-4 py-2 text-primary-foreground">
		{message.content}
	</div>
{:else if message.role === 'assistant'}
	<div class="flex flex-col gap-2">
		{#if message.content}
			<div class="prose prose-sm max-w-none dark:prose-invert">
				<!--TODO: fix by creating our own renderer, or sanitizing properly -->
				{@html renderMarkdown(message.content)}
			</div>
		{/if}
		{#each message.toolCalls as toolCall (toolCall.name)}
			<details class="rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
				<summary class="cursor-pointer text-muted-foreground">called {toolCall.name}</summary>
				<pre class="mt-2 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(
						toolCall.args,
						null,
						2
					)}</pre>
			</details>
		{/each}
	</div>
{:else if message.role === 'tool'}
	<details class="rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
		<summary class="cursor-pointer text-muted-foreground">{message.toolName} result</summary>
		<pre class="mt-2 overflow-x-auto whitespace-pre-wrap">{message.content}</pre>
	</details>
{/if}
