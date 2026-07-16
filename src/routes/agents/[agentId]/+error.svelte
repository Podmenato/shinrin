<script lang="ts">
	import { resolve } from '$app/paths';
	import ErrorEmptyState from '$lib/components/error-empty-state.svelte';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import type { ErrorProps } from './$types';

	let { error }: ErrorProps = $props();
</script>

<ErrorEmptyState
	icon={SearchXIcon}
	title={error.message}
	description="It may have been deleted, or the link is wrong."
	href={resolve('/agents')}
	linkText="Back to agents"
/>
