<script lang="ts">
	import { deleteSession } from '$lib/agents.remote';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	let { sessionId }: { sessionId: string } = $props();

	let open = $state(false);
	let deleting = $state(false);

	async function handleDelete() {
		deleting = true;
		try {
			await deleteSession(sessionId);
		} finally {
			deleting = false;
		}
	}
</script>

<AlertDialog.Root bind:open>
	<Button
		variant="destructive"
		size="icon-sm"
		type="button"
		aria-label="Delete session"
		onclick={(e) => {
			e.stopPropagation();
			open = true;
		}}
	>
		<Trash2Icon />
	</Button>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete session?</AlertDialog.Title>
			<AlertDialog.Description>
				This permanently deletes the conversation and its messages. This cannot be undone.
			</AlertDialog.Description>
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
