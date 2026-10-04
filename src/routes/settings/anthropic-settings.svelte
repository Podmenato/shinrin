<script lang="ts">
	import { getAnthropicSettings, saveAnthropicSettings } from '#lib/providerSettings.remote.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { toast } from 'svelte-sonner';

	const anthropicSettings = $derived(await getAnthropicSettings());

	const submitAnthropicForm = saveAnthropicSettings.enhance(async (form) => {
		const success = await form.submit();
		if (success) {
			toast.success('Settings saved');
		} else {
			toast.error('Saving failed');
		}
	});
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Anthropic</Card.Title>
		<Card.Description>Settings for the Anthropic (Claude) provider.</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		<form {...submitAnthropicForm} class="flex flex-col gap-4">
			<Field.Field>
				<Field.Label for="maxTokens">Max tokens</Field.Label>
				<Input
					id="maxTokens"
					min="1"
					{...saveAnthropicSettings.fields.maxTokens.as('number', anthropicSettings.maxTokens)}
				/>
				<Field.Description>
					Upper bound on tokens generated per reply. A cap, not a reservation — it costs nothing
					unless actually reached.
				</Field.Description>
				<Field.Error errors={saveAnthropicSettings.fields.maxTokens.issues()} />
			</Field.Field>
			<Field.Description>
				The API key is set via the <code>ANTHROPIC_API_KEY</code> environment variable in Docker, not
				here.
			</Field.Description>
			<Button type="submit" class="w-fit">Save</Button>
		</form>
	</Card.Content>
</Card.Root>
