<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';

	let { running, expiresAt, onStop }: { running: boolean; expiresAt: Date; onStop: () => void } =
		$props();

	const expiring = $derived(new Date(expiresAt).getTime() - Date.now() <= 0);
</script>

<div class="flex items-center justify-end gap-2">
	{#if expiring}
		<Spinner />
	{/if}
	<Button variant="outline" size="sm" disabled={!running || expiring} onclick={onStop}>Stop</Button>
</div>
