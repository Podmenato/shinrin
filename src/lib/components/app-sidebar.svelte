<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { mode, toggleMode } from 'mode-watcher';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import HouseIcon from '@lucide/svelte/icons/house';
	import BotIcon from '@lucide/svelte/icons/bot';
	import ServerIcon from '@lucide/svelte/icons/server';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';

	const items = [
		{ title: 'Home', href: resolve('/'), icon: HouseIcon },
		{ title: 'Agents', href: resolve('/agents'), icon: BotIcon }
	];
	const footerItems = [{ title: 'Ollama Settings', href: resolve('/ollama'), icon: ServerIcon }];
</script>

<Sidebar.Root>
	<Sidebar.Header>
		<span class="px-2 text-sm font-semibold tracking-tight">Shinrin</span>
	</Sidebar.Header>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.Menu>
				{#each items as item (item.href)}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={page.url.pathname === item.href}>
							{#snippet child({ props })}
								<a href={item.href} {...props}>
									<item.icon />
									<span>{item.title}</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Footer>
		<Sidebar.Menu>
			{#each footerItems as item (item.href)}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton isActive={page.url.pathname === item.href}>
						{#snippet child({ props })}
							<a href={item.href} {...props}>
								<item.icon />
								<span>{item.title}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{/each}
			<Sidebar.MenuItem>
				<Sidebar.MenuButton onclick={toggleMode}>
					{#if mode.current === 'dark'}
						<SunIcon />
						<span>Light mode</span>
					{:else}
						<MoonIcon />
						<span>Dark mode</span>
					{/if}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>
