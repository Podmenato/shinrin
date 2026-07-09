<script lang="ts">
	import * as Table from '$lib/components/ui/table';

	type Column = { width?: string; name: string };

	let { columns }: { columns: Column[] } = $props();
</script>

<Table.Header>
	<Table.Row>
		{#each columns as column, i (i)}
			<Table.Head class={column.width}>{column.name}</Table.Head>
		{/each}
	</Table.Row>
</Table.Header>
