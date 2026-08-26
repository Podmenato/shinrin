<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getSession } from '#lib/sessions.remote.js';
	import { autoAddSentenceCard } from '#lib/chatAnki.remote.js';
	import * as ContextMenu from '#lib/components/ui/context-menu/index.js';
	import AddToAnkiDialog, { type CardFields } from './add-to-anki-dialog.svelte';
	import { toast } from 'svelte-sonner';

	let { sessionId, children }: { sessionId: string; children: Snippet } = $props();

	const session = $derived(await getSession(sessionId));

	let hasSelection = $state(false);
	function updateSelectionState() {
		hasSelection = (window.getSelection()?.toString().trim().length ?? 0) > 0;
	}

	function currentSelection() {
		const selection = window.getSelection();
		const selectedText = selection?.toString().trim() ?? '';
		const anchorNode = selection?.anchorNode ?? null;
		const anchorEl = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
		const messageContent = anchorEl?.closest('[data-chat-message]')?.textContent?.trim();
		return { selectedText, messageContent: messageContent ?? selectedText };
	}

	function emptyCardFields(): CardFields {
		return {
			sentence: '',
			translation: '',
			reading: '',
			notes: '',
			tagsInput: '',
			readingDeck: '',
			productionDeck: '',
			listeningDeck: ''
		};
	}

	let dialogOpen = $state(false);
	let fields = $state(emptyCardFields());
	const canGenerateCard = $derived(!!session?.agent.subject);

	function addToAnkiManually() {
		const { selectedText } = currentSelection();
		const subject = session?.agent.subject;
		fields = {
			...emptyCardFields(),
			sentence: selectedText,
			readingDeck: subject?.readingDeck ?? '',
			productionDeck: subject?.productionDeck ?? '',
			listeningDeck: subject?.listeningDeck ?? ''
		};
		dialogOpen = true;
	}

	async function addToAnkiWithAi() {
		const { selectedText, messageContent } = currentSelection();
		const toastId = toast.loading('Generating...');
		try {
			await autoAddSentenceCard({ sessionId, selectedText, messageContent });
			toast.success('Added to Anki', { id: toastId });
		} catch {
			toast.error('Failed to add to Anki', { id: toastId });
		}
	}
</script>

<svelte:document onselectionchange={updateSelectionState} />

<ContextMenu.Root>
	<ContextMenu.Trigger disabled={!hasSelection} class="contents select-text">
		{@render children()}
	</ContextMenu.Trigger>
	<ContextMenu.Content>
		<ContextMenu.Item onSelect={addToAnkiManually}>Add to Anki</ContextMenu.Item>
		<ContextMenu.Item onSelect={addToAnkiWithAi} disabled={!canGenerateCard}>
			Add to Anki (AI)
		</ContextMenu.Item>
	</ContextMenu.Content>
</ContextMenu.Root>

<AddToAnkiDialog bind:open={dialogOpen} {fields} />
