<script lang="ts">
	import { getAgents } from '$lib/agents.remote';
	import * as Table from '$lib/components/ui/table/index';
	import BotIcon from '@lucide/svelte/icons/bot';
	import EmptyTable from '$lib/components/data-table/empty-table.svelte';
	import TableHeader from '$lib/components/data-table/table-header.svelte';
	import TableSkeletonBody from '$lib/components/data-table/table-skeleton-body.svelte';

	const agents = getAgents();

	const columns = [
		{ width: 'w-64', name: 'Name' },
		{ width: 'w-32', name: 'Created' },
		{ width: 'w-32', name: 'Updated' }
	];

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

{#if agents.error}
	<EmptyTable title="Couldn't load agents" description={agents.error.message} Icon={BotIcon} />
{:else if agents.current == null}
	<Table.Root class="table-fixed">
		<TableHeader {columns} />
		<TableSkeletonBody rows={3} />
	</Table.Root>
{:else if agents.current.length === 0}
	<EmptyTable
		title="No agents yet"
		description="Agents are seeded via the database for now."
		Icon={BotIcon}
	/>
{:else}
	<Table.Root class="table-fixed">
		<TableHeader {columns} />
		<Table.Body>
			{#each agents.current as agent (agent.id)}
				<Table.Row>
					<Table.Cell class="truncate font-medium">{agent.name}</Table.Cell>
					<Table.Cell>{formatDate(agent.createdAt)}</Table.Cell>
					<Table.Cell>{formatDate(agent.updatedAt)}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/if}
