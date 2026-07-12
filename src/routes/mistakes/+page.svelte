<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import MistakesTable from './mistakes-table.svelte';
</script>

<div class="p-2 sm:p-8">
	<Card.Root>
		<Card.Header>
			<Card.Title>Mistakes</Card.Title>
			<Card.Description>Mistakes agents have observed across all sessions.</Card.Description>
		</Card.Header>
		<Card.Content>
			<MistakesTable />
		</Card.Content>
	</Card.Root>
</div>
