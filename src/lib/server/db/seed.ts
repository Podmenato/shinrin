import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { agentTools, agents, tools } from './schema';
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
	"Never call find_card or find_note before calling get_decks first and matching the user's deck against the real list. " +
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

await db
	.insert(agents)
	.values([
		{ name: 'Japanese', systemPrompt: JAPANESE_SYSTEM_PROMPT },
		{ name: 'Mandarin', systemPrompt: MANDARIN_SYSTEM_PROMPT }
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

const excludedTools = ['add_note'];
const filteredTools = allTools.filter((t) => !excludedTools.includes(t.name));

await db.delete(agentTools);
await db
	.insert(agentTools)
	.values(
		allAgents.flatMap((agent) =>
			filteredTools.map((tool) => ({ agentId: agent.id, toolId: tool.id }))
		)
	);

console.log('Seeded agents, tools and agent_tools.');
await client.end();
