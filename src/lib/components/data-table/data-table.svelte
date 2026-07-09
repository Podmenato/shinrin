<script module lang="ts">
	import type { Component } from 'svelte';

	export type DataTableCell = string | { component: Component; props: Record<string, unknown> };

	export type DataTableColumn<T> = {
		name: string;
		width?: string;
		cell: (row: T) => DataTableCell;
	};

	export function renderComponent<Props extends Record<string, unknown>>(
		component: Component<Props>,
		props: Props
	): DataTableCell {
		return { component: component as Component, props };
	}
</script>

<script lang="ts" generics="T">
	import * as Table from '$lib/components/ui/table';
	import EmptyTable from './empty-table.svelte';
	import TableSkeletonBody from './table-skeleton-body.svelte';
	import TableHeader from './table-header.svelte';

	let {
		columns,
		data,
		error,
		rowKey,
		Icon,
		emptyTitle = 'No entries yet',
		emptyDesc
	}: {
		columns: DataTableColumn<T>[];
		data: T[] | undefined;
		error?: string;
		rowKey: (row: T) => string;
		Icon: Component;
		emptyTitle?: string;
		emptyDesc: string;
	} = $props();
</script>

{#if error}
	<EmptyTable title="Couldn't load data" description={error} {Icon} />
{:else if data == null}
	<Table.Root>
		<TableHeader {columns} />
		<TableSkeletonBody rows={3} />
	</Table.Root>
{:else if data.length === 0}
	<EmptyTable title={emptyTitle} description={emptyDesc} {Icon} />
{:else}
	<Table.Root>
		<TableHeader {columns} />
		<Table.Body>
			{#each data as row (rowKey(row))}
				<Table.Row>
					{#each columns as column, i (i)}
						<Table.Cell>
							{@const value = column.cell(row)}
							{#if typeof value === 'object'}
								{@const Cell = value.component}
								<Cell {...value.props} />
							{:else}
								{value}
							{/if}
						</Table.Cell>
					{/each}
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/if}
