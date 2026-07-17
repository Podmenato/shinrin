<script lang="ts">
	import { saveSubject, type Subject } from '$lib/subjects.remote';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { toast } from 'svelte-sonner';
	import { formatDateTime } from '$lib/date';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	const { subject }: { subject?: Subject } = $props();

	const subjectForm = $derived(subject ? saveSubject.for(subject.id) : saveSubject);
	const submitForm = $derived(
		subjectForm.enhance(async (form) => {
			const success = await form.submit();
			if (success) {
				if (subject) {
					toast.success('Subject saved');
				} else {
					toast.success('Subject created');
					await goto(resolve(`/subjects/${form.result?.id}`));
				}
			} else {
				toast.error('Saving failed');
			}
		})
	);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{subject?.name ?? 'New subject'}</Card.Title>
		<Card.Description>
			{#if subject}
				Created {formatDateTime(subject.createdAt)} · Updated {formatDateTime(subject.updatedAt)}
			{:else}
				Add a new study subject.
			{/if}
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<form {...submitForm} class="flex flex-col gap-4">
			{#if subject}
				<input {...subjectForm.fields.id.as('hidden', subject.id)} />
			{/if}

			<Field.Field>
				<Field.Label for="name">Name</Field.Label>
				<Input id="name" {...subjectForm.fields.name.as('text', subject?.name ?? '')} />
				<Field.Error errors={subjectForm.fields.name.issues()} />
			</Field.Field>

			<Field.Field>
				<Field.Label for="description">Description</Field.Label>
				<Textarea
					id="description"
					class="min-h-32"
					{...subjectForm.fields.description.as('text', subject?.description ?? '')}
				/>
				<Field.Error errors={subjectForm.fields.description.issues()} />
			</Field.Field>

			<div class="flex items-center justify-end gap-2">
				<div class="flex items-center justify-between gap-1">
					<Button type="submit" disabled={subjectForm.pending > 0}>
						{subject ? 'Save' : 'Create'}
					</Button>
					{#if subjectForm.pending > 0}<Spinner />{/if}
				</div>
			</div>
		</form>
	</Card.Content>
</Card.Root>
