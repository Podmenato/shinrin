<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import QuickAsksTable from './quick-asks-table.svelte';
</script>

<div class="p-2 sm:p-8">
	<Card.Root>
		<Card.Header>
			<Card.Title>Quick asks</Card.Title>
			<Card.Description>
				Presets that pre-fetch matching Anki cards and paste them straight into a prompt, skipping
				the agent's own find/cards_info round trip.
			</Card.Description>
			<Card.Action>
				<Button href={resolve('/quick-asks/new')}>New quick ask</Button>
			</Card.Action>
		</Card.Header>
		<Card.Content>
			<QuickAsksTable />
		</Card.Content>
	</Card.Root>
</div>
