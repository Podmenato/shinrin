<script lang="ts">
	import { getAllMistakes } from '$lib/mistakes.remote';
	import DataTable, { type DataTableColumn } from '$lib/components/data-table/data-table.svelte';
	import CircleXIcon from '@lucide/svelte/icons/circle-x';
	import { formatDateTime } from '$lib/date';

	const mistakes = getAllMistakes();

	type Mistake = Awaited<ReturnType<typeof getAllMistakes>>[number];

	const columns: DataTableColumn<Mistake>[] = [
		{ name: 'Agent', width: 'w-40', cell: (mistake) => mistake.agentName },
		{ name: 'Title', cell: (mistake) => mistake.title },
		{ name: 'Observed', width: 'w-40', cell: (mistake) => formatDateTime(mistake.createdAt) }
	];
</script>

<DataTable
	{columns}
	data={mistakes.current}
	error={mistakes.error?.message}
	rowKey={(mistake) => mistake.id}
	Icon={CircleXIcon}
	emptyTitle="No mistakes recorded yet"
	emptyDesc="Mistakes are logged by agents as they observe them during sessions."
/>
