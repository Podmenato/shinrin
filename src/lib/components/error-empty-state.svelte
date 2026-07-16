<script lang="ts">
	import type { Component } from 'svelte';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	let {
		icon,
		title,
		description,
		href,
		linkText
	}: {
		icon: Component;
		title: string;
		description?: string;
		href: string;
		linkText: string;
	} = $props();
</script>

<div class="flex h-full items-center justify-center p-8">
	<Empty.Root>
		<Empty.Header>
			<Empty.Media variant="icon">
				{@const Icon = icon}
				<Icon />
			</Empty.Media>
			<Empty.Title>{title}</Empty.Title>
			{#if description}
				<Empty.Description>{description}</Empty.Description>
			{/if}
		</Empty.Header>
		<Empty.Content>
			<!-- Full-page reload, not client-side nav: sveltejs/kit#16207 means a boundary that has
			     already failed once doesn't reliably clear on client-side navigation, so this link
			     forces a real navigation to get a clean app instance instead. -->
			<Button {href} data-sveltekit-reload={true}>{linkText}</Button>
		</Empty.Content>
	</Empty.Root>
</div>
