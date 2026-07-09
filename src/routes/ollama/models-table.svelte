<script lang="ts">
	import { getModels, stopRunningModel } from '$lib/ollamaAdmin.remote';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import ServerIcon from '@lucide/svelte/icons/server';
	import EmptyTable from '$lib/components/data-table/empty-table.svelte';
	import TableHeader from '$lib/components/data-table/table-header.svelte';
	import TableSkeletonBody from '$lib/components/data-table/table-skeleton-body.svelte';

	const models = getModels();

	const columns = [
		{ width: 'w-36', name: 'Name' },
		{ width: 'w-24', name: 'State' },
		{ width: 'w-20', name: 'Size' },
		{ width: 'w-28', name: 'Expires' },
		{ width: 'w-36 text-right', name: 'Actions' }
	];

	const sortedModels = $derived(
		(models.current ?? [])
			.slice()
			.sort((a, b) => Number(b.running) - Number(a.running) || a.model.localeCompare(b.model))
	);

	function formatBytes(bytes: number): string {
		return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
	}

	function isExpiring(expiresAt: Date) {
		const ms = new Date(expiresAt).getTime() - Date.now();
		return ms <= 0;
	}

	function formatExpires(expiresAt: Date): string {
		const ms = new Date(expiresAt).getTime() - Date.now();

		if (isExpiring(expiresAt)) {
			return 'expiring…';
		}

		const mins = Math.round(ms / 60_000);
		return mins < 60 ? `in ${mins}m` : `in ${(mins / 60).toFixed(1)}h`;
	}

	async function handleStop(model: string) {
		await stopRunningModel(model);
		await models.reconnect();
	}
</script>

{#if models.error}
	<EmptyTable title="Couldn't load models" description={models.error.message} Icon={ServerIcon} />
{:else if models.current == null}
	<Table.Root class="table-fixed">
		<TableHeader {columns} />
		<TableSkeletonBody rows={4} />
	</Table.Root>
{:else if sortedModels.length === 0}
	<EmptyTable
		title="No models downloaded"
		description="Pull a model with Ollama to see it here."
		Icon={ServerIcon}
	/>
{:else}
	<Table.Root class="table-fixed">
		<TableHeader {columns} />
		<Table.Body>
			{#each sortedModels as model (model.model)}
				<Table.Row>
					<Table.Cell class="truncate font-medium">{model.model}</Table.Cell>
					<Table.Cell>
						<Badge variant={model.running ? 'default' : 'outline'}>
							{model.running ? 'Running' : 'Stopped'}
						</Badge>
					</Table.Cell>
					<Table.Cell>{formatBytes(model.size)}</Table.Cell>
					<Table.Cell>{model.running ? formatExpires(model.expires_at) : '—'}</Table.Cell>
					<Table.Cell class="text-right">
						<div class="flex items-center justify-end gap-2">
							{#if isExpiring(model.expires_at)}
								<Spinner />
							{/if}
							<Button
								variant="outline"
								size="sm"
								disabled={!model.running || isExpiring(model.expires_at)}
								onclick={() => handleStop(model.model)}
							>
								Stop
							</Button>
						</div>
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/if}
