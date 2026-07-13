<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';

	let { status }: { status: string } = $props();

	const variant = $derived(
		status === 'mastered' ? 'default' : status === 'practicing' ? 'secondary' : 'outline'
	);
</script>

<Badge {variant}>{status}</Badge>
