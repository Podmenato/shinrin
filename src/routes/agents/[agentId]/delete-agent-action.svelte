<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { deleteAgent, getAgents } from '$lib/agents.remote';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';

	let { agentId }: { agentId: string } = $props();

	let deleting = $state(false);

	async function handleDelete() {
		deleting = true;
		try {
			await deleteAgent(agentId);
			await getAgents().refresh();
			await goto(resolve('/agents'));
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
			<AlertDialog.Title>Delete agent?</AlertDialog.Title>
			<AlertDialog.Description>
				This hides the agent, but its sessions, memories, and progress are kept.
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
