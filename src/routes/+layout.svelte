<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import { Toaster } from '$lib/components/ui/sonner/index.js';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<ModeWatcher />
<Toaster position="bottom-left" />

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset>
		<header class="flex items-center gap-2 border-b border-border px-4 py-3">
			<Sidebar.Trigger />
		</header>
		<div class="flex-1">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
