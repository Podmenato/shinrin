<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getAgents, getAllSessions, createSession } from '$lib/agents.remote';
	import { getModels } from '$lib/models.remote';

	type Agent = Awaited<ReturnType<typeof getAgents>>[0];

	let selectedAgent = $state<Agent | null>(null);
	let modelsPromise = $state<Promise<string[]> | null>(null);
	let showNewSession = $state(false);
	let newSessionName = $state('');
	let newSessionModel = $state('');
	let creating = $state(false);

	function selectAgent(agent: Agent) {
		selectedAgent = selectedAgent?.id === agent.id ? null : agent;
		showNewSession = false;
		modelsPromise = selectedAgent ? getModels() : null;
	}

	async function handleCreateSession() {
		if (!selectedAgent || !newSessionName.trim() || !newSessionModel) return;
		creating = true;
		const session = await createSession({
			agentId: selectedAgent.id,
			name: newSessionName.trim(),
			model: newSessionModel
		});
		await goto(resolve(`/chat/${session.id}`));
	}
</script>

<div class="min-h-screen bg-gray-950 text-gray-100">
	<div class="mx-auto max-w-3xl px-4 py-16">
		<h1 class="mb-2 text-3xl font-bold tracking-tight">Shinrin</h1>
		<p class="mb-12 text-gray-400">Your language study assistant.</p>

		<!-- Agent selection -->
		<section class="mb-10">
			<h2 class="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
				Select agent
			</h2>
			<div class="grid grid-cols-2 gap-3">
				{#each await getAgents() as agent (agent.id)}
					<button
						onclick={() => selectAgent(agent)}
						class="rounded-xl border px-6 py-5 text-left transition-colors {selectedAgent?.id ===
						agent.id
							? 'border-indigo-500 bg-indigo-500/10 text-white'
							: 'border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-600 hover:text-white'}"
					>
						<span class="text-lg font-medium">{agent.name}</span>
					</button>
				{/each}
			</div>
		</section>

		<!-- Sessions -->
		<section>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xs font-semibold uppercase tracking-widest text-gray-500">Sessions</h2>
				<button
					onclick={() => (showNewSession = !showNewSession)}
					disabled={!selectedAgent}
					title={selectedAgent ? '' : 'Select an agent first'}
					class="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
				>
					New session
				</button>
			</div>

			<!-- New session form -->
			{#if showNewSession && selectedAgent && modelsPromise}
					<div class="mb-4 rounded-xl border border-gray-700 bg-gray-900 p-5">
						<div class="mb-3">
							<label class="mb-1 block text-sm text-gray-400" for="session-name">Name</label>
							<input
								id="session-name"
								bind:value={newSessionName}
								placeholder="e.g. JLPT N2 grammar"
								class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
							/>
						</div>
						<div class="mb-4">
							<label class="mb-1 block text-sm text-gray-400" for="model-select">Model</label>
							<select
								id="model-select"
								bind:value={newSessionModel}
								class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
							>
								{#each await modelsPromise as model (model)}
									<option value={model}>{model}</option>
								{/each}
							</select>
						</div>
						<button
							onclick={handleCreateSession}
							disabled={creating || !newSessionName.trim()}
							class="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
						>
							{creating ? 'Creating…' : 'Start'}
						</button>
					</div>
				{/if}

			<!-- Session list -->
			{#each await getAllSessions() as session (session.id)}
				<a
					href={resolve(`/chat/${session.id}`)}
					class="mb-2 flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-5 py-4 hover:border-gray-600 hover:text-white"
				>
					<span class="font-medium">{session.name}</span>
					<span class="text-sm text-gray-500">{session.agentName} · {session.model}</span>
				</a>
			{:else}
				<p class="text-sm text-gray-500">No sessions yet.</p>
			{/each}
		</section>
	</div>
</div>
