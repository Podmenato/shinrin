<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getAgents, getAllSessions, createSession } from '$lib/agents.remote';
	import { getAvailableModels } from '$lib/ollamaAdmin.remote';
	import { runAgent } from '$lib/sessions.remote';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import DataTable, {
		renderComponent,
		type DataTableColumn
	} from '$lib/components/data-table/data-table.svelte';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import { formatDateTime } from '$lib/date';
	import { toast } from 'svelte-sonner';
	import DeleteSessionAction from './delete-session-action.svelte';

	const agents = getAgents();
	const sessions = getAllSessions();
	const availableModels = $derived(await getAvailableModels());

	let prompt = $state('');
	let agentId = $state('');
	let model = $state('');

	const isSending = $derived(createSession.pending > 0 || runAgent.pending > 0);
	const canStartChat = $derived(prompt.trim() !== '' && !!agentId && !!model && !isSending);

	async function startChat() {
		if (!canStartChat) return;

		const trimmed = prompt.trim();

		const session = await createSession({ agentId, name: trimmed.slice(0, 60), model });
		try {
			await runAgent({ sessionId: session.id, prompt: trimmed });
		} catch {
			toast.error('Failed to send message');
		}
		await goto(resolve(`/chat/${session.id}`));
	}

	const agentTriggerContent = $derived(
		agents.current?.find((a) => a.id === agentId)?.name ?? 'Select an agent'
	);
	const modelTriggerContent = $derived(
		availableModels.find((m) => m.model === model)?.model ?? 'Select a model'
	);

	type Session = Awaited<ReturnType<typeof getAllSessions>>[number];

	const columns: DataTableColumn<Session>[] = [
		{ name: 'Agent', width: 'w-40', cell: (session) => session.agentName },
		{ name: 'Session', cell: (session) => session.name },
		{ name: 'Model', width: 'w-48', cell: (session) => session.model },
		{ name: 'Created', width: 'w-40', cell: (session) => formatDateTime(session.createdAt) },
		{
			name: 'Actions',
			width: 'w-10',
			cell: (session) => renderComponent(DeleteSessionAction, { sessionId: session.id })
		}
	];

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			startChat();
		}
	}
</script>

<div class="flex flex-col gap-6 p-2 sm:p-8">
	<Card.Root>
		<Card.Header>
			<Card.Title>New chat</Card.Title>
			<Card.Description>Pick an agent and model, then start a conversation.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				class="flex flex-col gap-4"
				onsubmit={(e) => {
					e.preventDefault();
					startChat();
				}}
			>
				<div class="grid gap-4 sm:grid-cols-2">
					<Field.Field>
						<Field.Label for="agent">Agent</Field.Label>
						<Select.Root type="single" name="agentId" bind:value={agentId}>
							<Select.Trigger id="agent" class="w-full">
								{agentTriggerContent}
							</Select.Trigger>
							<Select.Content>
								{#each agents.current ?? [] as agent (agent.id)}
									<Select.Item value={agent.id} label={agent.name} />
								{/each}
							</Select.Content>
						</Select.Root>
					</Field.Field>

					<Field.Field>
						<Field.Label for="model">Model</Field.Label>
						<Select.Root type="single" name="model" bind:value={model}>
							<Select.Trigger id="model" class="w-full">
								{modelTriggerContent}
							</Select.Trigger>
							<Select.Content>
								{#each availableModels as availableModel (availableModel.model)}
									<Select.Item value={availableModel.model} label={availableModel.model} />
								{/each}
							</Select.Content>
						</Select.Root>
					</Field.Field>
				</div>

				<Field.Field>
					<Field.Label for="prompt">Message</Field.Label>
					<Textarea
						id="prompt"
						class="min-h-32"
						placeholder="Ask something..."
						bind:value={prompt}
						onkeydown={handleKeydown}
					/>
				</Field.Field>

				<div class="flex justify-end">
					<Button type="submit" disabled={!canStartChat}>
						{#if isSending}
							<Spinner />
						{:else}
							Start chat
						{/if}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Past sessions</Card.Title>
			<Card.Description>Resume a previous conversation.</Card.Description>
		</Card.Header>
		<Card.Content>
			<DataTable
				{columns}
				data={sessions.current}
				error={sessions.error?.message}
				rowKey={(session) => session.id}
				Icon={MessageSquareIcon}
				emptyTitle="No sessions yet"
				emptyDesc="Start a chat above to create your first session."
				onRowClick={(session) => goto(resolve(`/chat/${session.id}`))}
			/>
		</Card.Content>
	</Card.Root>
</div>
