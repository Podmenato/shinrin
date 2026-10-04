<script lang="ts">
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import OllamaSettings from './ollama-settings.svelte';
	import AnthropicSettings from './anthropic-settings.svelte';
	import MistralSettings from './mistral-settings.svelte';
</script>

<div class="p-2 sm:p-8">
	<Tabs.Root value="ollama">
		<Tabs.List>
			<Tabs.Trigger value="ollama">Ollama</Tabs.Trigger>
			<Tabs.Trigger value="anthropic">Anthropic</Tabs.Trigger>
			<Tabs.Trigger value="mistral">Mistral</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="ollama" class="flex flex-col gap-4">
			<OllamaSettings />
		</Tabs.Content>

		<Tabs.Content value="anthropic" class="flex flex-col gap-4">
			<AnthropicSettings />
		</Tabs.Content>

		<Tabs.Content value="mistral" class="flex flex-col gap-4">
			<MistralSettings />
		</Tabs.Content>
	</Tabs.Root>
</div>
