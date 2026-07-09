<script lang="ts">
	import * as Empty from '$lib/components/ui/empty';
	import type { Component } from 'svelte';

	let { title, description, Icon }: { title: string; description: string; Icon: Component } =
		$props();
</script>

<div class="flex h-full items-center justify-center">
	<Empty.Root>
		<Empty.Header>
			<Empty.Media variant="icon">
				<Icon />
			</Empty.Media>
			<Empty.Title>{title}</Empty.Title>
			<Empty.Description>{description}</Empty.Description>
		</Empty.Header>
	</Empty.Root>
</div>
