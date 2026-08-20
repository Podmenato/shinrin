<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { runQuickAsk } from '#lib/quickAsks.remote.js';
	import { runAgent } from '#lib/sessions.remote.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import PlayIcon from '@lucide/svelte/icons/play';
	import { isHttpError } from '@sveltejs/kit';
	import { toast } from 'svelte-sonner';

	let { quickAskId }: { quickAskId: string } = $props();

	let running = $state(false);

	async function run(e: MouseEvent) {
		e.stopPropagation();
		running = true;
		try {
			const { session, seedPrompt } = await runQuickAsk(quickAskId);
			runAgent({ sessionId: session.id, prompt: seedPrompt }).catch(() => {
				toast.error('Failed to send message');
			});
			await goto(resolve('/chat/[sessionId]', { sessionId: session.id }));
		} catch (err) {
			toast.error(isHttpError(err) ? err.body.message : 'Failed to run quick ask');
		} finally {
			running = false;
		}
	}
</script>

<Button
	variant="outline"
	size="icon-sm"
	type="button"
	isLoading={running}
	onclick={run}
	aria-label="Run"
>
	<PlayIcon />
</Button>
