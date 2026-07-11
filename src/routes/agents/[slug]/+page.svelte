<script lang="ts">
	import { resolve } from '$app/paths';
	import { getAgentById, updateAgent } from '$lib/agents.remote';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { toast } from 'svelte-sonner';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import DeleteAgentAction from './delete-agent-action.svelte';
	import { formatDateTime } from '$lib/date';

	let { params } = $props();
	const { slug } = $derived(params);

	const agent = $derived(await getAgentById(slug));

	const agentForm = $derived(updateAgent.for(agent.id));
	const saveAgent = $derived(
		agentForm.enhance(async ({ submit }) => {
			if (await submit()) {
				toast.success('Agent saved');
			} else {
				toast.error('Saving failed');
			}
		})
	);
</script>

<div class="flex flex-col gap-4 p-2 sm:p-8">
	<a
		href={resolve('/agents')}
		class="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeftIcon class="size-4" />
		Back to agents
	</a>

	<Card.Root>
		<Card.Header>
			<Card.Title>{agent.name}</Card.Title>
			<Card.Description>
				Created {formatDateTime(agent.createdAt)} · Updated {formatDateTime(agent.updatedAt)}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form {...saveAgent} class="flex flex-col gap-4">
				<input {...agentForm.fields.id.as('hidden', agent.id)} />

				<Field.Field>
					<Field.Label for="name">Name</Field.Label>
					<Input id="name" {...agentForm.fields.name.as('text', agent.name)} />
					<Field.Error errors={agentForm.fields.name.issues()} />
				</Field.Field>

				<Field.Field>
					<Field.Label for="systemPrompt">System prompt</Field.Label>
					<Textarea
						id="systemPrompt"
						class="min-h-48"
						{...agentForm.fields.systemPrompt.as('text', agent.systemPrompt ?? '')}
					/>
					<Field.Error errors={agentForm.fields.systemPrompt.issues()} />
				</Field.Field>

				<div class="flex items-center justify-end gap-2">
					<DeleteAgentAction agentId={agent.id} />
					<div class="flex items-center justify-between gap-1">
						<Button type="submit" disabled={agentForm.pending > 0}>Save</Button>
						{#if agentForm.pending > 0}<Spinner />{/if}
					</div>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
