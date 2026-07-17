<script lang="ts">
	import { resolve } from '$app/paths';
	import { getSubjectById } from '$lib/subjects.remote';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import SubjectForm from '../subject-form.svelte';

	let { params } = $props();
	const { subjectId } = $derived(params);

	const subject = $derived(await getSubjectById(subjectId));
</script>

<div class="flex flex-col gap-4 p-2 sm:p-8">
	<a
		href={resolve('/subjects')}
		class="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeftIcon class="size-4" />
		Back to subjects
	</a>

	<SubjectForm {subject} />
</div>
