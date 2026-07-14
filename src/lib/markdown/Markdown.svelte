<script lang="ts">
	import { parseMarkdown } from './parser';
	import MarkdownBlock from './MarkdownBlock.svelte';

	const { content }: { content: string } = $props();
	const blocks = $derived(parseMarkdown(content));

	// File generated 100% by Claude, I didn't review it at all
	// Replace with a library if causes problems
</script>

{#each blocks as block, i (i)}
	<MarkdownBlock {block} />
{/each}
