<script lang="ts">
	import { getModels, stopRunningModel } from '$lib/ollamaAdmin.remote';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import ServerIcon from '@lucide/svelte/icons/server';
	import EmptyTable from '$lib/components/data-table/empty-table.svelte';

	const models = getModels();

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
	<div class="flex h-full items-center justify-center">
		<EmptyTable title="Couldn't load models" description={models.error.message} Icon={ServerIcon} />
	</div>
{:else if models.current == null}
	<Table.Root class="table-fixed">
		<Table.Header>
			<Table.Row>
				<Table.Head class="w-36">Name</Table.Head>
				<Table.Head class="w-24">State</Table.Head>
				<Table.Head class="w-20">Size</Table.Head>
				<Table.Head class="w-28">Expires</Table.Head>
				<Table.Head class="w-36 text-right">Actions</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each { length: 4 }, i (i)}
				<Table.Row>
					<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
					<Table.Cell><Skeleton class="h-5 w-16 rounded-full" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-12" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-16" /></Table.Cell>
					<Table.Cell class="text-right"><Skeleton class="ml-auto h-8 w-16" /></Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{:else if sortedModels.length === 0}
	<div class="flex h-full items-center justify-center">
		<Empty.Root>
			<Empty.Header>
				<Empty.Media variant="icon">
					<ServerIcon />
				</Empty.Media>
				<Empty.Title>No models downloaded</Empty.Title>
				<Empty.Description>Pull a model with Ollama to see it here.</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	</div>
{:else}
	<Table.Root class="table-fixed">
		<Table.Header>
			<Table.Row>
				<Table.Head class="w-36">Name</Table.Head>
				<Table.Head class="w-24">State</Table.Head>
				<Table.Head class="w-20">Size</Table.Head>
				<Table.Head class="w-28">Expires</Table.Head>
				<Table.Head class="w-36 text-right">Actions</Table.Head>
			</Table.Row>
		</Table.Header>
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
