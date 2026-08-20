<script lang="ts">
	import { resolve } from '$app/paths';
	import { getQuickAskById } from '#lib/quickAsks.remote.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import QuickAskForm from '../quick-ask-form.svelte';

	let { params } = $props();
	const { quickAskId } = $derived(params);

	const quickAsk = $derived(await getQuickAskById(quickAskId));
</script>

<div class="flex flex-col gap-4 p-2 sm:p-8">
	<a
		href={resolve('/quick-asks')}
		class="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeftIcon class="size-4" />
		Back to quick asks
	</a>

	<QuickAskForm {quickAsk} />
</div>
