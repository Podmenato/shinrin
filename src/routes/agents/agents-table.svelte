<script lang="ts">
	import { getAgents } from '$lib/agents.remote';
	import * as Table from '$lib/components/ui/table/index';
	import * as Empty from '$lib/components/ui/empty/index';
	import { Skeleton } from '$lib/components/ui/skeleton/index';
	import BotIcon from '@lucide/svelte/icons/bot';
	import EmptyTable from '$lib/components/data-table/empty-table.svelte';

	const agents = getAgents();

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

{#if agents.error}
	<div class="flex h-full items-center justify-center">
		<EmptyTable title="Couldn't load agents" description={agents.error.message} Icon={BotIcon} />
	</div>
{:else if agents.current == null}
	<Table.Root class="table-fixed">
		<Table.Header>
			<Table.Row>
				<Table.Head class="w-64">Name</Table.Head>
				<Table.Head class="w-32">Created</Table.Head>
				<Table.Head class="w-32">Updated</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each { length: 3 }, i (i)}
				<Table.Row>
					<Table.Cell><Skeleton class="h-4 w-40" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-20" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-20" /></Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{:else if agents.current.length === 0}
	<div class="flex h-full items-center justify-center">
		<Empty.Root>
			<Empty.Header>
				<Empty.Media variant="icon">
					<BotIcon />
				</Empty.Media>
				<Empty.Title>No agents yet</Empty.Title>
				<Empty.Description>Agents are seeded via the database for now.</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	</div>
{:else}
	<Table.Root class="table-fixed">
		<Table.Header>
			<Table.Row>
				<Table.Head class="w-64">Name</Table.Head>
				<Table.Head class="w-32">Created</Table.Head>
				<Table.Head class="w-32">Updated</Table.Head>
			</Table.Row>
		</Table.Header>
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
