<script lang="ts">
	import type { BlockNode } from './parser';
	import MarkdownInline from './MarkdownInline.svelte';

	const { block }: { block: BlockNode } = $props();

	// File generated 100% by Claude, I didn't review it at all
	// Replace with a library if causes problems
</script>

{#if block.type === 'heading'}
	{#if block.level === 1}
		<h1><MarkdownInline nodes={block.children} /></h1>
	{:else if block.level === 2}
		<h2><MarkdownInline nodes={block.children} /></h2>
	{:else if block.level === 3}
		<h3><MarkdownInline nodes={block.children} /></h3>
	{:else if block.level === 4}
		<h4><MarkdownInline nodes={block.children} /></h4>
	{:else if block.level === 5}
		<h5><MarkdownInline nodes={block.children} /></h5>
	{:else}
		<h6><MarkdownInline nodes={block.children} /></h6>
	{/if}
{:else if block.type === 'paragraph'}
	<p><MarkdownInline nodes={block.children} /></p>
{:else if block.type === 'codeblock'}
	<pre><code class={block.lang ? `language-${block.lang}` : undefined}>{block.code}</code></pre>
{:else if block.type === 'blockquote'}
	<blockquote><MarkdownInline nodes={block.children} /></blockquote>
{:else if block.type === 'list'}
	{#if block.ordered}
		<ol>
			{#each block.items as item, i (i)}
				<li><MarkdownInline nodes={item} /></li>
			{/each}
		</ol>
	{:else}
		<ul>
			{#each block.items as item, i (i)}
				<li><MarkdownInline nodes={item} /></li>
			{/each}
		</ul>
	{/if}
{:else if block.type === 'hr'}
	<hr />
{:else if block.type === 'table'}
	<table>
		<thead>
			<tr>
				{#each block.headers as cell, i (i)}
					<th><MarkdownInline nodes={cell} /></th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each block.rows as row, i (i)}
				<tr>
					{#each row as cell, j (j)}
						<td><MarkdownInline nodes={cell} /></td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
