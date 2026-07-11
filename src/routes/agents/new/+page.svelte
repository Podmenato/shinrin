<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import AgentForm from '../agent-form.svelte';
</script>

<div class="flex flex-col gap-4 p-2 sm:p-8">
	<a
		href={resolve('/agents')}
		class="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeftIcon class="size-4" />
		Back to agents
	</a>

	<AgentForm />
</div>
