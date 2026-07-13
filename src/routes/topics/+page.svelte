<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import TopicsTable from './topics-table.svelte';
</script>

<div class="p-2 sm:p-8">
	<Card.Root>
		<Card.Header>
			<Card.Title>Topics</Card.Title>
			<Card.Description>Study topics agents are tracking across all sessions.</Card.Description>
		</Card.Header>
		<Card.Content>
			<TopicsTable />
		</Card.Content>
	</Card.Root>
</div>
