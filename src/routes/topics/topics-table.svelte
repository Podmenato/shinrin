<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getAllTopics } from '$lib/topics.remote';
	import DataTable, {
		renderComponent,
		type DataTableColumn
	} from '$lib/components/data-table/data-table.svelte';
	import TopicStatusBadge from './topic-status-badge.svelte';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import { formatDateTime } from '$lib/date';

	const topics = getAllTopics();

	type Topic = Awaited<ReturnType<typeof getAllTopics>>[number];

	function openTopic(topic: Topic) {
		goto(resolve(`/topics/${topic.id}`));
	}

	const columns: DataTableColumn<Topic>[] = [
		{ name: 'Agent', width: 'w-40', cell: (topic) => topic.agentName },
		{ name: 'Topic', cell: (topic) => topic.topic },
		{
			name: 'Status',
			width: 'w-32',
			cell: (topic) => renderComponent(TopicStatusBadge, { status: topic.status })
		},
		{ name: 'Updated', width: 'w-40', cell: (topic) => formatDateTime(topic.updatedAt) }
	];
</script>

<DataTable
	{columns}
	data={topics.current}
	error={topics.error?.message}
	rowKey={(topic) => topic.id}
	Icon={BookOpenIcon}
	emptyTitle="No topics tracked yet"
	emptyDesc="Topics are logged by agents as they track your learning progress."
	onRowClick={openTopic}
/>
