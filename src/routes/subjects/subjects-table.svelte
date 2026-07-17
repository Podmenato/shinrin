<script lang="ts">
	import { goto } from '$app/navigation';
	import { getSubjects, type Subject } from '$lib/subjects.remote';
	import DataTable, { type DataTableColumn } from '$lib/components/data-table/data-table.svelte';
	import LibraryBigIcon from '@lucide/svelte/icons/library-big';
	import { resolve } from '$app/paths';
	import { formatDate } from '$lib/date';

	const subjects = getSubjects();

	function openSubject(subject: Subject) {
		goto(resolve(`/subjects/${subject.id}`));
	}

	const columns: DataTableColumn<Subject>[] = [
		{ name: 'Name', width: 'w-64', cell: (subject) => subject.name },
		{ name: 'Description', cell: (subject) => subject.description ?? '' },
		{ name: 'Created', width: 'w-32', cell: (subject) => formatDate(subject.createdAt) },
		{ name: 'Updated', width: 'w-32', cell: (subject) => formatDate(subject.updatedAt) }
	];
</script>

<DataTable
	{columns}
	data={subjects.current}
	error={subjects.error?.message}
	rowKey={(subject) => subject.id}
	Icon={LibraryBigIcon}
	emptyTitle="No subjects yet"
	emptyDesc="Create a subject to start tracking study progress."
	onRowClick={openSubject}
/>
