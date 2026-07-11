<script lang="ts">
	import { saveAgent, type Agent } from '$lib/agents.remote';
	import { getTools } from '$lib/tools.remote';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { toast } from 'svelte-sonner';
	import DeleteAgentAction from './[slug]/delete-agent-action.svelte';
	import { formatDateTime } from '$lib/date';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	const { agent }: { agent?: Agent & { toolIds: string[] } } = $props();

	const allTools = $derived(await getTools());

	let isSubagent = $derived(agent?.isSubagent ?? false);

	const agentForm = $derived(agent ? saveAgent.for(agent.id) : saveAgent);
	const submitForm = $derived(
		agentForm.enhance(async (form) => {
			const success = await form.submit();
			if (success) {
				if (agent) {
					toast.success('Agent saved');
				} else {
					toast.success('Agent created');
					await goto(resolve(`/agents/${form.result?.id}`));
				}
			} else {
				toast.error('Saving failed');
			}
		})
	);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{agent?.name ?? 'New agent'}</Card.Title>
		<Card.Description>
			{#if agent}
				Created {formatDateTime(agent.createdAt)} · Updated {formatDateTime(agent.updatedAt)}
			{:else}
				Configure a new language tutor agent.
			{/if}
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<form {...submitForm} class="flex flex-col gap-4">
			{#if agent}
				<input {...agentForm.fields.id.as('hidden', agent.id)} />
			{/if}

			<Field.Field>
				<Field.Label for="name">Name</Field.Label>
				<Input id="name" {...agentForm.fields.name.as('text', agent?.name ?? '')} />
				<Field.Error errors={agentForm.fields.name.issues()} />
			</Field.Field>

			<Field.Field>
				<Field.Label for="systemPrompt">System prompt</Field.Label>
				<Textarea
					id="systemPrompt"
					class="min-h-48"
					{...agentForm.fields.systemPrompt.as('text', agent?.systemPrompt ?? '')}
				/>
				<Field.Error errors={agentForm.fields.systemPrompt.issues()} />
			</Field.Field>

			<Field.Field orientation="horizontal">
				<Checkbox id="isSubagent" name="b:isSubagent" bind:checked={isSubagent} />
				<Field.Label for="isSubagent" class="font-normal">Allow as subagent</Field.Label>
			</Field.Field>

			{#if isSubagent}
				<Field.Field>
					<Field.Label for="subagentDescription">Subagent description</Field.Label>
					<Textarea
						id="subagentDescription"
						placeholder="Describe what this agent does and when another agent should call it as a subagent."
						{...agentForm.fields.subagentDescription.as('text', agent?.subagentDescription ?? '')}
					/>
					<Field.Error errors={agentForm.fields.subagentDescription.issues()} />
				</Field.Field>
			{/if}

			<Field.Set>
				<Field.Legend variant="label">Tools</Field.Legend>
				<div data-slot="checkbox-group" class="flex flex-col gap-3">
					{#each allTools as tool (tool.id)}
						<Field.Field orientation="horizontal">
							<Checkbox
								id="tool-{tool.id}"
								name="toolIds[]"
								value={tool.id}
								checked={agent?.toolIds.includes(tool.id) ?? false}
							/>
							<Field.Label for="tool-{tool.id}" class="font-normal">{tool.name}</Field.Label>
						</Field.Field>
					{/each}
				</div>
				<Field.Error errors={agentForm.fields.toolIds.issues()} />
			</Field.Set>

			<div class="flex items-center justify-end gap-2">
				{#if agent}
					<DeleteAgentAction agentId={agent.id} />
				{/if}
				<div class="flex items-center justify-between gap-1">
					<Button type="submit" disabled={agentForm.pending > 0}>
						{agent ? 'Save' : 'Create'}
					</Button>
					{#if agentForm.pending > 0}<Spinner />{/if}
				</div>
			</div>
		</form>
	</Card.Content>
</Card.Root>
