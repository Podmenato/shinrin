<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { deleteAgent, getAgents, getDependentSubjects } from '#lib/agents.remote.js';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';

	let { agentId }: { agentId: string } = $props();

	const dependentSubjects = $derived(await getDependentSubjects(agentId));
	const dependentSubjectNames = $derived(dependentSubjects.map((s) => s.name));

	let isDeleting = $state(false);
	const isBlocked = $derived(dependentSubjectNames.length > 0);

	async function handleDelete() {
		isDeleting = true;
		try {
			await deleteAgent(agentId);
			await getAgents().refresh();
			await goto(resolve('/agents'));
		} finally {
			isDeleting = false;
		}
	}
</script>

{#if isBlocked}
	<p class="text-sm text-muted-foreground">
		{dependentSubjectNames.join(', ')} depend on this agent, change that before deleting.
	</p>
{/if}

<AlertDialog.Root>
	<AlertDialog.Trigger disabled={isBlocked}>
		{#snippet child({ props })}
			<Button variant="destructive" type="button" disabled={isBlocked} {...props}>Delete</Button>
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
			<AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
			{#if isDeleting}<Spinner />{/if}
			<AlertDialog.Action variant="destructive" onclick={handleDelete} disabled={isDeleting}>
				Delete
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
