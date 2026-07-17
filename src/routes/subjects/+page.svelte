<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import SubjectsTable from './subjects-table.svelte';
</script>

<div class="p-2 sm:p-8">
	<Card.Root>
		<Card.Header>
			<Card.Title>Subjects</Card.Title>
			<Card.Description>Subjects available for study.</Card.Description>
			<Card.Action>
				<Button href={resolve('/subjects/new')}>New subject</Button>
			</Card.Action>
		</Card.Header>
		<Card.Content>
			<SubjectsTable />
		</Card.Content>
	</Card.Root>
</div>
