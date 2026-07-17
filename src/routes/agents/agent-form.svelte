<script lang="ts">
	import { saveAgent, getAssignableSubagents, type Agent } from '$lib/agents.remote';
	import { getTools } from '$lib/tools.remote';
	import { getSubjects } from '$lib/subjects.remote';
	import { getAvailableModels } from '$lib/ollamaAdmin.remote';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { toast } from 'svelte-sonner';
	import DeleteAgentAction from './[agentId]/delete-agent-action.svelte';
	import { formatDateTime } from '$lib/date';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { isHttpError } from '@sveltejs/kit';

	const { agent }: { agent?: Agent & { toolIds: string[]; subagentIds: string[] } } = $props();

	const allTools = $derived(await getTools());
	const allSubjects = $derived(await getSubjects());
	const availableModels = $derived(await getAvailableModels());

	let toolsOpen = $state(false);
	let subagentsOpen = $state(false);

	let isSubagent = $derived(agent?.isSubagent ?? false);
	let defaultModel = $derived(agent?.defaultModel ?? '');
	let subjectId = $derived(agent?.subjectId ?? '');
	const modelTriggerContent = $derived(
		availableModels.find((m) => m.model === defaultModel)?.model ?? 'Use the calling agent’s model'
	);
	const subjectTriggerContent = $derived(
		allSubjects.find((s) => s.id === subjectId)?.name ?? 'No subject'
	);

	const assignableSubagents = $derived(
		await getAssignableSubagents({
			agentId: agent?.id ?? null,
			subjectId: subjectId.trim() === '' ? null : subjectId
		})
	);

	const assignableTools = $derived(
		subjectId.trim() === '' ? allTools.filter((t) => !t.isSubjectRequired) : allTools
	);

	const agentForm = $derived(agent ? saveAgent.for(agent.id) : saveAgent);
	const submitForm = $derived(
		agentForm.enhance(async (form) => {
			try {
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
			} catch (e) {
				toast.error(isHttpError(e) ? e.body.message : 'Saving failed');
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
				<Field.Label for="subjectId">Subject</Field.Label>
				<Select.Root type="single" name="subjectId" bind:value={subjectId}>
					<Select.Trigger id="subjectId" class="w-full">
						{subjectTriggerContent}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="" label="No subject" />
						{#each allSubjects as subject (subject.id)}
							<Select.Item value={subject.id} label={subject.name} />
						{/each}
					</Select.Content>
				</Select.Root>
				<Field.Error errors={agentForm.fields.subjectId.issues()} />
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

				<Field.Field>
					<Field.Label for="defaultModel">Model</Field.Label>
					<Select.Root type="single" name="defaultModel" bind:value={defaultModel}>
						<Select.Trigger id="defaultModel" class="w-full">
							{modelTriggerContent}
						</Select.Trigger>
						<Select.Content>
							{#each availableModels as model (model.model)}
								<Select.Item value={model.model} label={model.model} />
							{/each}
						</Select.Content>
					</Select.Root>
					<Field.Error errors={agentForm.fields.defaultModel.issues()} />
				</Field.Field>
			{/if}

			<Field.Set>
				<Collapsible.Root bind:open={toolsOpen}>
					<Collapsible.Trigger class="flex w-full items-center justify-between text-sm font-medium">
						<span>Tools ({agent?.toolIds.length ?? 0} selected)</span>
						<ChevronDownIcon
							class="size-4 text-muted-foreground transition-transform {toolsOpen
								? 'rotate-180'
								: ''}"
						/>
					</Collapsible.Trigger>
					<Collapsible.Content>
						<ScrollArea class="mt-3 h-48 rounded-md border p-3">
							<div data-slot="checkbox-group" class="flex flex-col gap-3">
								{#each assignableTools as tool (tool.id)}
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
						</ScrollArea>
					</Collapsible.Content>
				</Collapsible.Root>
				<Field.Error errors={agentForm.fields.toolIds.issues()} />
			</Field.Set>

			<Field.Set>
				<Collapsible.Root bind:open={subagentsOpen}>
					<Collapsible.Trigger class="flex w-full items-center justify-between text-sm font-medium">
						<span>Subagents ({agent?.subagentIds.length ?? 0} selected)</span>
						<ChevronDownIcon
							class="size-4 text-muted-foreground transition-transform {subagentsOpen
								? 'rotate-180'
								: ''}"
						/>
					</Collapsible.Trigger>
					<Collapsible.Content>
						<ScrollArea class="mt-3 h-48 rounded-md border p-3">
							<div data-slot="checkbox-group" class="flex flex-col gap-3">
								{#each assignableSubagents as subagent (subagent.id)}
									<Field.Field orientation="horizontal">
										<Checkbox
											id="subagent-{subagent.id}"
											name="subagentIds[]"
											value={subagent.id}
											checked={agent?.subagentIds.includes(subagent.id) ?? false}
										/>
										<Field.Label for="subagent-{subagent.id}" class="font-normal">
											{subagent.name}
										</Field.Label>
									</Field.Field>
								{:else}
									<p class="text-sm text-muted-foreground">No subagents available</p>
								{/each}
							</div>
						</ScrollArea>
					</Collapsible.Content>
				</Collapsible.Root>
				<Field.Error errors={agentForm.fields.subagentIds.issues()} />
			</Field.Set>

			<div class="flex items-center justify-end gap-2">
				{#if agent}
					<DeleteAgentAction agentId={agent.id} />
				{/if}
				<Button type="submit" disabled={agentForm.pending > 0} isLoading={agentForm.pending > 0}>
					{agent ? 'Save' : 'Create'}
				</Button>
			</div>
		</form>
	</Card.Content>
</Card.Root>
