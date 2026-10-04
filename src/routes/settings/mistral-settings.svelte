<script lang="ts">
	import { getMistralSettings, saveMistralSettings } from '#lib/providerSettings.remote.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { toast } from 'svelte-sonner';

	const mistralSettings = $derived(await getMistralSettings());

	const submitMistralForm = saveMistralSettings.enhance(async (form) => {
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
		<Card.Title>Mistral</Card.Title>
		<Card.Description>Settings for the Mistral provider.</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		<form {...submitMistralForm} class="flex flex-col gap-4">
			<Field.Field>
				<Field.Label for="mistralMaxTokens">Max tokens</Field.Label>
				<Input
					id="mistralMaxTokens"
					min="1"
					{...saveMistralSettings.fields.maxTokens.as('number', mistralSettings.maxTokens)}
				/>
				<Field.Description>
					Upper bound on tokens generated per reply. A cap, not a reservation — it costs nothing
					unless actually reached.
				</Field.Description>
				<Field.Error errors={saveMistralSettings.fields.maxTokens.issues()} />
			</Field.Field>
			<Field.Field>
				<Field.Label for="mistralTemperature">Temperature</Field.Label>
				<Input
					id="mistralTemperature"
					min="0"
					max="1.5"
					step="0.1"
					{...saveMistralSettings.fields.temperature.as('number', mistralSettings.temperature)}
				/>
				<Field.Description>
					Randomness of replies, 0–1.5 — lower is more focused, higher more varied. Leave empty to
					use each model's own default.
				</Field.Description>
				<Field.Error errors={saveMistralSettings.fields.temperature.issues()} />
			</Field.Field>
			<Field.Description>
				The API key is set via the <code>MISTRAL_API_KEY</code> environment variable in Docker, not here.
			</Field.Description>
			<Button type="submit" class="w-fit">Save</Button>
		</form>
	</Card.Content>
</Card.Root>
