<script lang="ts">
	import { getAgentById } from '$lib/agents.remote';

	let { params } = $props();
	const { slug } = $derived(params);

	const agentQuery = $derived(getAgentById(slug));
</script>

<div class="p-2 sm:p-8"></div>
