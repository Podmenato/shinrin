<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getQuickAsks, type QuickAsk } from '#lib/quickAsks.remote.js';
	import DataTable, {
		renderComponent,
		type DataTableColumn
	} from '#lib/components/data-table/data-table.svelte';
	import ZapIcon from '@lucide/svelte/icons/zap';
	import RunQuickAskAction from './run-quick-ask-action.svelte';

	const quickAsks = getQuickAsks();

	function openQuickAsk(quickAsk: QuickAsk) {
		goto(resolve('/quick-asks/[quickAskId]', { quickAskId: quickAsk.id }));
	}

	const columns: DataTableColumn<QuickAsk>[] = [
		{ name: 'Name', cell: (q) => q.name },
		{ name: 'Agent', width: 'w-40', cell: (q) => q.agentName },
		{ name: 'Deck', width: 'w-48', cell: (q) => q.deck },
		{ name: 'State', width: 'w-24', cell: (q) => q.state },
		{ name: 'Days', width: 'w-20', cell: (q) => q.days?.toString() ?? '—' },
		{
			name: 'Actions',
			width: 'w-16',
			cell: (q) => renderComponent(RunQuickAskAction, { quickAskId: q.id })
		}
	];
</script>

<DataTable
	{columns}
	data={quickAsks.current}
	error={quickAsks.error?.message}
	rowKey={(q) => q.id}
	Icon={ZapIcon}
	emptyTitle="No quick asks yet"
	emptyDesc="Create a quick ask to fetch preselected cards straight into a prompt."
	onRowClick={openQuickAsk}
/>
