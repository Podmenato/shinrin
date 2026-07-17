import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import {
	agentSubagents,
	agentTools,
	agents,
	messages,
	mistakeObservations,
	sessions,
	studyTopics,
	subjects,
	tools
} from './schema';
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
	'  create_topic / update_topic — the learning status of a specific grammar point, vocab set, etc. Check existing topics in your context before creating a new one — create_topic fails if one with that name already exists, use update_topic instead.\n' +
	'  create_mistake / update_mistake — a plain-language note every time the user makes a mistake worth tracking. Just log it with create_mistake; do not worry about duplicates, that gets consolidated separately later.\n' +
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
	.insert(subjects)
	.values([
		{ name: 'Japanese', description: 'Japanese language study.' },
		{ name: 'English', description: 'English language study.' },
		{ name: 'Mandarin', description: 'Mandarin Chinese language study.' },
		{ name: 'German', description: 'German language study.' }
	])
	.onConflictDoNothing();

const allSubjects = await db.select().from(subjects);
const subjectsByName = new Map(allSubjects.map((s) => [s.name, s]));

await db
	.insert(agents)
	.values([
		{
			name: 'Japanese',
			systemPrompt: JAPANESE_SYSTEM_PROMPT,
			subjectId: subjectsByName.get('Japanese')?.id
		},
		{
			name: 'Mandarin',
			systemPrompt: MANDARIN_SYSTEM_PROMPT,
			subjectId: subjectsByName.get('Mandarin')?.id
		},
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
		{ name: 'create_topic', isSubjectRequired: true },
		{ name: 'update_topic' },
		{ name: 'create_mistake', isSubjectRequired: true },
		{ name: 'update_mistake' }
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
	'create_topic',
	'update_topic',
	'create_mistake',
	'update_mistake'
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
await db
	.insert(agentTools)
	.values(
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
	Object.entries(MISTAKE_NOTES).flatMap(([subjectName, notes]) => {
		const subject = subjectsByName.get(subjectName);
		if (!subject) return [];
		return notes.map(({ title, note }) => ({ subjectId: subject.id, title, note }));
	})
);

const TOPIC_PROGRESS: Record<string, { topic: string; status: string; notes?: string }[]> = {
	Japanese: [
		{
			topic: 'べき grammar',
			status: 'practicing',
			notes: 'Comfortable with plain statements, still shaky on negative form べきではない.'
		},
		{ topic: 'て-form', status: 'mastered' },
		{
			topic: 'keigo basics',
			status: 'introduced',
			notes: 'Covered 尊敬語 vs 謙譲語 distinction once.'
		}
	],
	Mandarin: [
		{ topic: 'tones 1-4', status: 'practicing', notes: '3rd tone sandhi still inconsistent.' },
		{ topic: 'family vocab', status: 'introduced' },
		{ topic: 'numbers 1-100', status: 'mastered' }
	]
};

await db.delete(studyTopics);
await db.insert(studyTopics).values(
	Object.entries(TOPIC_PROGRESS).flatMap(([subjectName, topics]) => {
		const subject = subjectsByName.get(subjectName);
		if (!subject) return [];
		return topics.map(({ topic, status, notes }) => ({
			subjectId: subject.id,
			topic,
			status,
			notes: notes ?? null
		}));
	})
);

const SESSION_SEEDS: Record<
	string,
	{ name: string; model: string; messages: { role: 'user' | 'assistant'; content: string }[] }[]
> = {
	Japanese: [
		{
			name: 'べき grammar practice',
			model: 'gemma4:26b-mlx',
			messages: [
				{ role: 'user', content: 'Can you explain when to use べきではない vs べきじゃない?' },
				{
					role: 'assistant',
					content:
						'べきではない is the more formal/written form, while べきじゃない is casual spoken Japanese. Both mean "should not" — 彼は行くべきではない (formal) vs 彼は行くべきじゃない (casual). Want a few contrastive example sentences?'
				},
				{ role: 'user', content: 'Yes, a couple examples would help.' },
				{
					role: 'assistant',
					content:
						'1. 授業中にスマホを使うべきではない。(You should not use your phone during class — formal)\n2. そんなに焦るべきじゃないよ。(You shouldn’t rush so much — casual, said to a friend)'
				}
			]
		},
		{
			name: 'Keigo roleplay',
			model: 'gemma4:31b-mlx',
			messages: [
				{ role: 'user', content: "Let's roleplay a job interview in keigo." },
				{
					role: 'assistant',
					content:
						'かしこまりました。では面接官として始めますね。「本日はお越しいただき、誠にありがとうございます。まず自己紹介をお願いできますでしょうか。」'
				}
			]
		}
	],
	Mandarin: [
		{
			name: 'Tone practice: 你好',
			model: 'gemma4:e4b-mlx',
			messages: [
				{ role: 'user', content: 'Why do I keep mixing up the tones in 你好?' },
				{
					role: 'assistant',
					content:
						'你 and 好 are both 3rd tone — when two 3rd tones meet in a row, the first one shifts to a 2nd tone in speech (tone sandhi), so 你好 is actually said ní hǎo, not nǐ hǎo. Want a few more 3rd-tone pairs to practice?'
				},
				{ role: 'user', content: 'Yes please, give me some examples.' },
				{
					role: 'assistant',
					content:
						'我很好 (wǒ hěn hǎo) → 我 shifts to 2nd tone: wó hěn hǎo.\nTry saying 你也很好 out loud — 你 and 也 both shift up since they lead into another 3rd tone.'
				}
			]
		},
		{
			name: 'Family vocab intro',
			model: 'qwen3.6:27b-mlx',
			messages: [
				{ role: 'user', content: 'Teach me basic family words.' },
				{
					role: 'assistant',
					content:
						'爸爸 (bàba) = dad, 妈妈 (māma) = mom, 哥哥 (gēge) = older brother, 姐姐 (jiějie) = older sister. Want younger sibling words too?'
				}
			]
		}
	]
};

await db.delete(messages);
await db.delete(sessions);
for (const [agentName, sessionSeeds] of Object.entries(SESSION_SEEDS)) {
	const agent = agentsByName.get(agentName);
	if (!agent) continue;
	for (const seed of sessionSeeds) {
		const [session] = await db
			.insert(sessions)
			.values({ agentId: agent.id, name: seed.name, model: seed.model })
			.returning();
		await db.insert(messages).values(
			seed.messages.map((m) => ({
				sessionId: session.id,
				role: m.role,
				content: m.content
			}))
		);
	}
}

console.log(
	'Seeded agents, tools, subjects, agent_tools, agent_subagents, mistake_observations, study_topics, sessions and messages.'
);
await client.end();
