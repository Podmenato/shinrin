<script lang="ts">
	import { getModels, type OllamaModel, stopRunningModel } from '$lib/ollamaAdmin.remote';
	import DataTable, {
		renderComponent,
		type DataTableColumn
	} from '$lib/components/data-table/data-table.svelte';
	import ModelStateBadge from './model-state-badge.svelte';
	import ModelActionsCell from './model-actions-cell.svelte';
	import ServerIcon from '@lucide/svelte/icons/server';

	const models = getModels();

	const sortedModels = $derived(
		(models.current ?? [])
			.slice()
			.sort((a, b) => Number(b.running) - Number(a.running) || a.model.localeCompare(b.model))
	);

	function formatBytes(bytes: number): string {
		return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
	}

	function formatExpires(expiresAt: Date): string {
		const ms = new Date(expiresAt).getTime() - Date.now();

		if (ms <= 0) {
			return 'expiring…';
		}

		const mins = Math.round(ms / 60_000);
		return mins < 60 ? `in ${mins}m` : `in ${(mins / 60).toFixed(1)}h`;
	}

	async function handleStop(model: string) {
		await stopRunningModel(model);
		await models.reconnect();
	}

	const columns: DataTableColumn<OllamaModel>[] = [
		{ name: 'Name', width: 'w-36', cell: (model) => model.model },
		{
			name: 'State',
			width: 'w-24',
			cell: (model) => renderComponent(ModelStateBadge, { running: model.running })
		},
		{ name: 'Size', width: 'w-20', cell: (model) => formatBytes(model.size) },
		{
			name: 'Expires',
			width: 'w-28',
			cell: (model) => (model.running ? formatExpires(model.expires_at) : '—')
		},
		{
			name: 'Actions',
			width: 'w-36 text-right',
			cell: (model) =>
				renderComponent(ModelActionsCell, {
					running: model.running,
					expiresAt: model.expires_at,
					onStop: () => handleStop(model.model)
				})
		}
	];
</script>

<DataTable
	{columns}
	data={models.current === null ? undefined : sortedModels}
	error={models.error?.message}
	rowKey={(model) => model.model}
	Icon={ServerIcon}
	emptyTitle="No models downloaded"
	emptyDesc="Pull a model with Ollama to see it here."
/>
