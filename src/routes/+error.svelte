<script lang="ts">
	import { resolve } from '$app/paths';
	import ErrorEmptyState from '$lib/components/error-empty-state.svelte';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import type { ErrorProps } from './$types';

	let { error }: ErrorProps = $props();
</script>

<ErrorEmptyState
	icon={CircleAlertIcon}
	title={error.message}
	href={resolve('/')}
	linkText="Back to home"
/>
