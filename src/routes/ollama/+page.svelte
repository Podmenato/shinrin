<script lang="ts">
	import { getModels } from '$lib/ollamaAdmin.remote';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import ModelsTable from './models-table.svelte';

	const models = getModels();
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
		<Card.Footer class="justify-end gap-2">
			{#if models.loading}
				<Spinner />
			{/if}
			<Button
				variant="outline"
				size="sm"
				disabled={models.loading}
				onclick={() => models.refresh()}
			>
				Refresh
			</Button>
		</Card.Footer>
	</Card.Root>
</div>
