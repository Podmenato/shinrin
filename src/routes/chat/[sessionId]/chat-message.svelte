<script lang="ts">
	import Markdown from '#lib/markdown/Markdown.svelte';
	import Quiz from './quiz.svelte';
	import type { Message } from '#lib/server/contextManager.js';

	const { message }: { message: Message } = $props();
</script>

{#if message.role === 'user'}
	<div
		data-chat-message
		class="ml-auto max-w-[75%] rounded-2xl bg-primary px-4 py-2 text-primary-foreground"
	>
		{message.content}
	</div>
{:else if message.role === 'assistant'}
	<div class="flex flex-col gap-2">
		{#if message.content}
			<div data-chat-message class="prose prose-sm max-w-none dark:prose-invert">
				<Markdown content={message.content} />
			</div>
		{/if}
		{#each message.toolCalls as toolCall (toolCall.name)}
			<!--TODO: what if result fails ? needs some error handling -->
			{#if toolCall.name === 'present_quiz'}
				<Quiz args={toolCall.args} />
			{:else}
				<details class="rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
					<summary class="cursor-pointer text-muted-foreground">called {toolCall.name}</summary>
					<pre class="mt-2 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(
							toolCall.args,
							null,
							2
						)}</pre>
				</details>
			{/if}
		{/each}
	</div>
{:else if message.role === 'tool'}
	<details class="rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
		<summary class="cursor-pointer text-muted-foreground">{message.toolName} result</summary>
		<pre class="mt-2 overflow-x-auto whitespace-pre-wrap">{message.content}</pre>
	</details>
{/if}
