<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';

	let { running }: { running: boolean } = $props();
</script>

<Badge variant={running ? 'default' : 'outline'}>
	{running ? 'Running' : 'Stopped'}
</Badge>
