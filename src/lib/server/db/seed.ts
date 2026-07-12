import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { agentSubagents, agentTools, agents, mistakeObservations, tools } from './schema';
import { currentMode, loadEnv } from '../env';

// Runs standalone (tsx, not Vite) — nothing has populated process.env for
// us, so we have to load the right .env.[mode] file ourselves before
// reading DATABASE_URL below.
loadEnv(currentMode());

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

const MEMORY_RULES =
	'You have three separate ways to remember things across sessions — use the right one:\n' +
	'  save_memory — stable facts and preferences about the user (e.g. level, teaching style). Check existing memories already in your context before picking a key.\n' +
	'  update_topic_progress — the learning status of a specific grammar point, vocab set, etc. Check existing topics in your context before naming a new one.\n' +
	'  log_mistake — a plain-language note every time the user makes a mistake worth tracking. Just log it; do not worry about duplicates, that gets consolidated separately later.\n' +
	'\n';

const SHARED_RULES =
	'For any Anki operation — listing decks, searching notes or cards, checking review intervals, or adding sentence notes — call the anki subagent tool with one clear, self-contained natural-language instruction. ' +
	'It has no memory of this conversation, so include every needed detail (deck names, full sentence/translation content, IDs). It will not ask you clarifying questions back, so be specific the first time.\n' +
	'You have a maximum of 7 tool calls per response. Plan accordingly: if a task needs more steps than available, ask the user to clarify or break it down before calling any tools.\n' +
	'\n' +
	MEMORY_RULES;

const JAPANESE_SYSTEM_PROMPT =
	'You are a Japanese language study assistant connected to Anki. Always respond in English unless the user asks otherwise.\n' +
	'The user is studying at JLPT N2 level and above. Assists the user by explaining grammar and vocab he asks for.\n' +
	'Practice dialogues roleplay with the user, or give them and check writing prompts.\n' +
	'Explain nuance, register, subtle differences between similar expressions, and formal/written usage where relevant. ' +
	'For grammar, cite the pattern, give a few contrastive examples, and note any exceptions or register constraints.\n' +
	'\n' +
	'Flashcard decks to use:\n' +
	'  Reading (R):    Japanese generated (R)\n' +
	'  Production (P): Japanese generated (P)\n' +
	'  Listening (L):  Japanese generated (L)\n' +
	'\n' +
	'Always show proposed cards first and wait for explicit confirmation before adding anything to Anki.\n' +
	'\n' +
	SHARED_RULES;

const MANDARIN_SYSTEM_PROMPT =
	'You are a Mandarin Chinese study assistant for absolute beginners, connected to Anki. Always respond in English.\n' +
	'\n' +
	'The user is a complete beginner. Keep all explanations simple and friendly. Assume they have almost none vocab base unless explicitly stated. Current progression will be loaded from memories and topic progress.' +
	'Introduce tones explicitly (1st–4th + neutral) and always include pinyin with tone marks. ' +
	'Prefer short, practical sentences and high-frequency vocabulary. ' +
	'Practice dialogues roleplay with the user, or give them and check writing prompts.\n' +
	'When making flashcards, keep the target language simple enough for a beginner to read and understand within a few seconds.\n' +
	'\n' +
	'Flashcard decks to use:\n' +
	'  Reading (R):    Mandarin generated (R)\n' +
	'  Production (P): Mandarin generated (P)\n' +
	'  Listening (L):  Mandarin generated (L)\n' +
	'\n' +
	'Always show proposed cards first and wait for explicit confirmation before adding anything to Anki.\n' +
	'\n' +
	SHARED_RULES;

const ANKI_SYSTEM_PROMPT =
	'You are an Anki operations subagent. Another agent calls you with a specific request and relays your reply straight to its own user — you never talk to a user directly.\n' +
	'\n' +
	'Do exactly what is asked using your tools, then reply with only the essential result: the requested data, an id, a count, or a short confirmation. ' +
	'No greetings, no explaining what you are about to do, no follow-up questions, no suggestions — one line where possible.\n' +
	'Never call find before calling get_decks first and matching the requested deck name against the real list.\n' +
	'If a request is ambiguous, or names a deck, note type, or card that does not exist, say so in one line instead of guessing.\n' +
	'You have a maximum of 7 tool calls per run.';

const ANKI_SUBAGENT_DESCRIPTION =
	'Executes Anki flashcard operations: listing decks, searching notes/cards, reading card intervals, and adding sentence notes. ' +
	'Call it with one clear, self-contained natural-language instruction describing exactly what to do, including deck names and full content — it has no memory of this conversation. ' +
	'Returns only the requested data or a short confirmation; it will not ask clarifying questions back.';

await db
	.insert(agents)
	.values([
		{ name: 'Japanese', systemPrompt: JAPANESE_SYSTEM_PROMPT },
		{ name: 'Mandarin', systemPrompt: MANDARIN_SYSTEM_PROMPT },
		{
			name: 'Anki',
			systemPrompt: ANKI_SYSTEM_PROMPT,
			isSubagent: true,
			subagentDescription: ANKI_SUBAGENT_DESCRIPTION
		}
	])
	.onConflictDoNothing();

await db
	.insert(tools)
	.values([
		{ name: 'current_time_tool' },
		{ name: 'get_decks' },
		{ name: 'add_note' },
		{ name: 'add_sentence_note' },
		{ name: 'find' },
		{ name: 'get_note_types' },
		{ name: 'get_note_info' },
		{ name: 'cards_info' },
		{ name: 'get_intervals' },
		{ name: 'save_memory' },
		{ name: 'delete_memory' },
		{ name: 'update_topic_progress' },
		{ name: 'log_mistake' }
	])
	.onConflictDoNothing();

const allAgents = await db.select().from(agents);
const allTools = await db.select().from(tools);
const toolsByName = new Map(allTools.map((t) => [t.name, t]));
const agentsByName = new Map(allAgents.map((a) => [a.name, a]));

function toolIdsFor(names: string[]): string[] {
	return names.map((name) => {
		const tool = toolsByName.get(name);
		if (!tool) throw new Error(`Seed tool not found: ${name}`);
		return tool.id;
	});
}

const LANGUAGE_AGENT_TOOL_NAMES = [
	'current_time_tool',
	'save_memory',
	'delete_memory',
	'update_topic_progress',
	'log_mistake'
];

// add_note is deliberately excluded — add_sentence_note is the preferred, less error-prone path.
const ANKI_TOOL_NAMES = [
	'get_decks',
	'add_sentence_note',
	'find',
	'get_note_types',
	'get_note_info',
	'cards_info',
	'get_intervals'
];

const agentToolNames: Record<string, string[]> = {
	Japanese: LANGUAGE_AGENT_TOOL_NAMES,
	Mandarin: LANGUAGE_AGENT_TOOL_NAMES,
	Anki: ANKI_TOOL_NAMES
};

await db.delete(agentTools);
await db.insert(agentTools).values(
	allAgents.flatMap((agent) =>
		toolIdsFor(agentToolNames[agent.name] ?? []).map((toolId) => ({ agentId: agent.id, toolId }))
	)
);

const ankiAgent = agentsByName.get('Anki');
await db.delete(agentSubagents);
if (ankiAgent) {
	const parentAgents = ['Japanese', 'Mandarin']
		.map((name) => agentsByName.get(name))
		.filter((agent) => agent !== undefined);
	await db
		.insert(agentSubagents)
		.values(parentAgents.map((agent) => ({ agentId: agent.id, subagentId: ankiAgent.id })));
}

const MISTAKE_NOTES: Record<string, { title: string; note: string }[]> = {
	Japanese: [
		{
			title: 'だ/です mixing',
			note: 'Confused だ and です when switching between plain and polite form mid-sentence.'
		},
		{
			title: 'て-form misuse',
			note: 'Used て-form to connect two clauses that had no logical relation.'
		},
		{ title: '大人 misreading', note: 'Misread 大人 as だいにん instead of おとな.' }
	],
	Mandarin: [
		{ title: 'Tone mixup', note: 'Mixed up the 3rd tone and 2nd tone in 你好.' },
		{ title: '了 vs 要', note: 'Used 了 to express future intent instead of 要.' },
		{ title: 'Missing measure word', note: 'Dropped the measure word before 书 in a sentence.' }
	]
};

await db.delete(mistakeObservations);
await db.insert(mistakeObservations).values(
	Object.entries(MISTAKE_NOTES).flatMap(([agentName, notes]) => {
		const agent = agentsByName.get(agentName);
		if (!agent) return [];
		return notes.map(({ title, note }) => ({ agentId: agent.id, title, note }));
	})
);

console.log('Seeded agents, tools, agent_tools, agent_subagents and mistake_observations.');
await client.end();
