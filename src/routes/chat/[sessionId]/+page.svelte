<script lang="ts">
    import {runAgent} from '$lib/sessions.remote';
    import type {PageData} from './$types';
    import {resolve} from '$app/paths';

    type Message = PageData['messages'][0];

    let {data}: { data: PageData } = $props();

    // svelte-ignore state_referenced_locally
    let messages = $state<Message[]>(data.messages.filter((m) => m.role !== 'system'));
    let input = $state('');
    let running = $state(false);
    let chatEl = $state<HTMLElement | null>(null);

    $effect(() => {
        if (messages.length) chatEl?.scrollTo({top: chatEl.scrollHeight, behavior: 'smooth'});
    });

    async function send() {
        if (!input.trim() || running) return;
        const prompt = input.trim();
        input = '';
        running = true;

        messages.push({
            id: crypto.randomUUID(),
            sessionId: data.session.id,
            role: 'user',
            content: prompt,
            toolName: null,
            createdAt: new Date()
        });

        const response = await runAgent({sessionId: data.session.id, prompt});

        messages.push({
            id: crypto.randomUUID(),
            sessionId: data.session.id,
            role: 'assistant',
            content: response,
            toolName: null,
            createdAt: new Date()
        });

        running = false;
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    }
</script>

<div class="flex h-screen flex-col bg-gray-950 text-gray-100">
    <!-- Header -->
    <header class="flex items-center gap-4 border-b border-gray-800 px-6 py-4">
        <a href={resolve('/')} class="text-gray-500 hover:text-white">←</a>
        <div>
            <h1 class="font-semibold">{data.session.name}</h1>
            <p class="text-xs text-gray-500">{data.session.agent.name} · {data.session.model}</p>
        </div>
    </header>

    <!-- Messages -->
    <div bind:this={chatEl} class="flex-1 overflow-y-auto px-4 py-6">
        <div class="mx-auto max-w-2xl space-y-4">
            {#if messages.filter((m) => m.role === 'user' || m.role === 'assistant').length === 0}
                <p class="text-center text-sm text-gray-600">Send a message to start the session.</p>
            {/if}

            {#each messages as message (message.id)}
                {#if message.role === 'user'}
                    <div class="flex justify-end">
                        <div class="max-w-[75%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-3 text-sm">
                            {message.content}
                        </div>
                    </div>
                {:else if message.role === 'assistant'}
                    <div class="flex justify-start">
                        <div
                                class="max-w-[75%] rounded-2xl rounded-tl-sm bg-gray-800 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                        >
                            {message.content}
                        </div>
                    </div>
                {:else if message.role === 'tool'}
                    <div class="flex justify-center">
						<span class="rounded-full bg-gray-900 px-3 py-1 text-xs text-gray-500">
							tool: {message.toolName}
						</span>
                    </div>
                {/if}
            {/each}

            {#if running}
                <div class="flex justify-start">
                    <div class="rounded-2xl rounded-tl-sm bg-gray-800 px-4 py-3">
						<span class="flex gap-1">
							<span class="animate-bounce text-gray-400" style="animation-delay: 0ms">·</span>
							<span class="animate-bounce text-gray-400" style="animation-delay: 150ms">·</span>
							<span class="animate-bounce text-gray-400" style="animation-delay: 300ms">·</span>
						</span>
                    </div>
                </div>
            {/if}
        </div>
    </div>

    <!-- Input -->
    <div class="border-t border-gray-800 px-4 py-4">
        <div class="mx-auto flex max-w-2xl gap-3">
			<textarea
                    bind:value={input}
                    onkeydown={onKeydown}
                    disabled={running}
                    placeholder="Message… (Enter to send, Shift+Enter for newline)"
                    rows="1"
                    class="flex-1 resize-none rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none disabled:opacity-40"
            ></textarea>
            <button
                    onclick={send}
                    disabled={running || !input.trim()}
                    class="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
            >
                Send
            </button>
        </div>
    </div>
</div>
