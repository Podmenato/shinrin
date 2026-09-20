<script lang="ts">
	import { getOllamaSettings, saveOllamaSettings } from '#lib/providerSettings.remote.js';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import ModelsTable from './models-table.svelte';
	import { toast } from 'svelte-sonner';

	const ollamaSettings = $derived(await getOllamaSettings());

	const submitForm = saveOllamaSettings.enhance(async (form) => {
		const success = await form.submit();
		if (success) {
			toast.success('Settings saved');
		} else {
			toast.error('Saving failed');
		}
	});
</script>

<div class="p-2 sm:p-8">
	<Tabs.Root value="providers">
		<Tabs.List>
			<Tabs.Trigger value="providers">Providers</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="providers" class="flex flex-col gap-4">
			<Card.Root>
				<Card.Header>
					<Card.Title>Ollama</Card.Title>
					<Card.Description>Settings for the local Ollama provider.</Card.Description>
				</Card.Header>
				<Card.Content class="flex flex-col gap-4">
					<form {...submitForm} class="flex flex-col gap-4">
						<Field.Field>
							<Field.Label for="numCtx">Context window (num_ctx)</Field.Label>
							<Input
								id="numCtx"
								min="1"
								{...saveOllamaSettings.fields.numCtx.as('number', ollamaSettings.numCtx)}
							/>
							<Field.Description>
								Tokens of conversation history Ollama keeps per request. Higher uses more memory per
								request; lower drops older turns sooner.
							</Field.Description>
							<Field.Error errors={saveOllamaSettings.fields.numCtx.issues()} />
						</Field.Field>
						<Button type="submit" class="w-fit">Save</Button>
					</form>

					<Field.Separator />

					<div class="flex flex-col gap-2">
						<Field.Title>Downloaded models</Field.Title>
						<Field.Description>
							Models currently pulled locally, and whether they're loaded into memory.
						</Field.Description>
						<div class="h-64 overflow-y-auto">
							<ModelsTable />
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>
