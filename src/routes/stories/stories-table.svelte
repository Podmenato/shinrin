<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getAllStories, type Story } from '$lib/stories.remote';
	import DataTable, { type DataTableColumn } from '$lib/components/data-table/data-table.svelte';
	import BookMarkedIcon from '@lucide/svelte/icons/book-marked';
	import { formatDateTime } from '$lib/date';

	const stories = getAllStories();

	function openStory(story: Story) {
		goto(resolve(`/stories/${story.id}`));
	}

	const columns: DataTableColumn<Story>[] = [
		{ name: 'Title', cell: (story) => story.title },
		{ name: 'Subjects', width: 'w-48', cell: (story) => story.subjectNames.join(', ') || '—' },
		{ name: 'Updated', width: 'w-40', cell: (story) => formatDateTime(story.updatedAt) }
	];
</script>

<DataTable
	{columns}
	data={stories.current}
	error={stories.error?.message}
	rowKey={(story) => story.id}
	Icon={BookMarkedIcon}
	emptyTitle="No stories yet"
	emptyDesc="Stories are saved by agents as interactive content to revisit later."
	onRowClick={openStory}
/>
