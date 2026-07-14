<script lang="ts">
	import type { InlineNode } from './parser';

	const { nodes }: { nodes: InlineNode[] } = $props();

	// File generated 100% by Claude, I didn't review it at all
	// Replace with a library if causes problems
</script>

{#each nodes as node, i (i)}
	{#if node.type === 'text'}
		{node.value}
	{:else if node.type === 'bold'}
		<strong>{node.value}</strong>
	{:else if node.type === 'italic'}
		<em>{node.value}</em>
	{:else if node.type === 'strike'}
		<del>{node.value}</del>
	{:else if node.type === 'code'}
		<code>{node.value}</code>
	{:else if node.type === 'link'}
		<a href={node.href} target="_blank" rel="external noopener noreferrer">{node.text}</a>
	{/if}
{/each}
