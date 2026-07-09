<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import AgentsTable from './agents-table.svelte';
</script>

<div class="p-2 sm:p-8">
	<Card.Root>
		<Card.Header>
			<Card.Title>Agents</Card.Title>
			<Card.Description>Language tutor agents and their configuration.</Card.Description>
		</Card.Header>
		<Card.Content>
			<AgentsTable />
		</Card.Content>
	</Card.Root>
</div>
