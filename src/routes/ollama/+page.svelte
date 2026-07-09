<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import ModelsTable from './models-table.svelte';
</script>

<div class="p-2 sm:p-8">
	<Card.Root>
		<Card.Header>
			<Card.Title>Ollama Models</Card.Title>
			<Card.Description>Downloaded models and whether they're currently loaded.</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="h-64 overflow-y-auto">
				<ModelsTable />
			</div>
		</Card.Content>
	</Card.Root>
</div>
