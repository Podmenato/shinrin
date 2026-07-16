<script lang="ts">
	import { resolve } from '$app/paths';
	import ErrorEmptyState from '$lib/components/error-empty-state.svelte';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import type { ErrorProps } from './$types';

	const { error }: ErrorProps = $props();
</script>

<ErrorEmptyState
	icon={SearchXIcon}
	title={error.message}
	href={resolve('/')}
	linkText="Back to home"
/>
