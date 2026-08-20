<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { deleteQuickAsk, getQuickAsks } from '#lib/quickAsks.remote.js';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';

	let { quickAskId }: { quickAskId: string } = $props();

	let deleting = $state(false);

	async function handleDelete() {
		deleting = true;
		try {
			await deleteQuickAsk(quickAskId);
			await getQuickAsks().refresh();
			await goto(resolve('/quick-asks'));
		} finally {
			deleting = false;
		}
	}
</script>

<AlertDialog.Root>
	<AlertDialog.Trigger>
		{#snippet child({ props })}
			<Button variant="destructive" type="button" {...props}>Delete</Button>
		{/snippet}
	</AlertDialog.Trigger>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete quick ask?</AlertDialog.Title>
			<AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={deleting}>Cancel</AlertDialog.Cancel>
			{#if deleting}<Spinner />{/if}
			<AlertDialog.Action variant="destructive" onclick={handleDelete} disabled={deleting}>
				Delete
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
