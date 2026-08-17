<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import StoriesTable from './stories-table.svelte';
</script>

<div class="p-2 sm:p-8">
	<Card.Root>
		<Card.Header>
			<Card.Title>Stories</Card.Title>
			<Card.Description>Interactive content saved for later use.</Card.Description>
		</Card.Header>
		<Card.Content>
			<StoriesTable />
		</Card.Content>
	</Card.Root>
</div>
