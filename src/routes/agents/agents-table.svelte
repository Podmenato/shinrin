<script lang="ts">
	import { goto } from '$app/navigation';
	import { getAgents, type Agent } from '$lib/agents.remote';
	import DataTable, { type DataTableColumn } from '$lib/components/data-table/data-table.svelte';
	import BotIcon from '@lucide/svelte/icons/bot';
	import { resolve } from '$app/paths';

	const agents = getAgents();

	function openAgent(agent: Agent) {
		goto(resolve(`/agents/${agent.id}`));
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	const columns: DataTableColumn<Agent>[] = [
		{ name: 'Name', width: 'w-64', cell: (agent) => agent.name },
		{ name: 'Created', width: 'w-32', cell: (agent) => formatDate(agent.createdAt) },
		{ name: 'Updated', width: 'w-32', cell: (agent) => formatDate(agent.updatedAt) }
	];
</script>

<DataTable
	{columns}
	data={agents.current}
	error={agents.error?.message}
	rowKey={(agent) => agent.id}
	Icon={BotIcon}
	emptyTitle="No agents yet"
	emptyDesc="Agents are seeded via the database for now."
	onRowClick={openAgent}
/>
