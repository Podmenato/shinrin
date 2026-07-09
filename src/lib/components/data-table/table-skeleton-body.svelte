<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import { Skeleton } from '$lib/components/ui/skeleton';

	let { rows }: { rows: number } = $props();
</script>

<Table.Body>
	{#each { length: rows }, i (i)}
		<Table.Row>
			<Table.Cell colspan={100}>
				<Skeleton class="h-4 w-full" />
			</Table.Cell>
		</Table.Row>
	{/each}
</Table.Body>
