import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import {
	agentSubagents,
	agentTools,
	agents,
	files,
	messages,
	mistakeObservations,
	sessions,
	stories,
	storyContent,
	storyResources,
	studyTopics,
	subjects,
	tools
} from './schema';
import { currentMode, loadEnv } from '../env';

// Runs standalone (tsx, not Vite) — nothing has populated process.env for
// us, so we have to load the right .env.[mode] file ourselves before
// reading DATABASE_URL below.
loadEnv(currentMode());

mkdirSync(dirname(process.env.DATABASE_URL!), { recursive: true });
const client = new Database(process.env.DATABASE_URL!);
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
	'Be plain and direct. No flowery language, no filler openers ("Excellent!", "Great job!", "Certainly!"), no editorializing about what an answer supposedly reveals about the user\'s broader ability ("this shows true mastery," "you are moving beyond X"). ' +
	'State whether the user is right or wrong in one short clause, then go straight to the substance — the correction, the nuance, the next point. Cut anything that does not teach.\n' +
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
	'Do exactly what is asked using your tools, then reply with only the essential result: the requested data, card detail, a count, or a short confirmation. ' +
	'No greetings, no explaining what you are about to do, no follow-up questions, no suggestions — one line where possible.\n' +
	'Always invoke tools through your actual tool-calling mechanism, one at a time. Never write out a tool call, or a plan of tool calls, as JSON or any other text in your reply — that is not a real call and nothing will happen.\n' +
	'Never call find before calling get_decks first and matching the requested deck name against the real list.\n' +
	"If a named deck, note type, or card doesn't match exactly, pick the closest real match yourself (substring, JLPT level, or other obvious equivalent) and proceed with it — mention the substitution in a short clause, do not ask back. Only refuse if no plausible match exists.\n" +
	'If a request is otherwise ambiguous, say so in one line instead of guessing.\n' +
	'"Due", "failed", and "new" are different card states — do not conflate them, and do not substitute one for another when unsure:\n' +
	"  all due cards    → find with states:['due']\n" +
	"  failed today     → find with rated_days:1, rated_ease:1 — NOT states:['due'], a card can be due without ever being reviewed\n" +
	"  new cards today  → find with added:1, states:['new']\n" +
	'Trust the first find call that directly answers the request. Do not run a second, broader find "to be safe" and report that instead — if the first result answers what was asked, use it.\n' +
	'When you fetch card or note detail (cards_info, get_note_info) for a list of IDs, your reply must include every one of those IDs — never silently drop an item from the list, even if the list is long or the fields are verbose. ' +
	'You may drop or summarize fields within an item that seem irrelevant to the request, but never drop an entire card or note.\n' +
	'You have a maximum of 7 tool calls per run.';

const ANKI_SUBAGENT_DESCRIPTION =
	'Executes Anki flashcard operations: listing decks, searching notes/cards, reading card intervals, fetching full card/note content (fields, front/back) for a given list of card IDs or note IDs, and adding sentence notes. ' +
	'Call it with one clear, self-contained natural-language instruction describing exactly what to do, including deck names, IDs, and full content — it has no memory of this conversation. ' +
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
		{ name: 'fetch_url' },
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
		{ name: 'update_mistake' },
		{ name: 'save_story' },
		{ name: 'fetch_url' },
		{ name: 'present_quiz' }
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
	'update_mistake',
	'save_story',
	'fetch_url',
	'present_quiz'
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

// Stories are subject-independent — the same story can carry content variants
// in several subjects (e.g. a Japanese article you also study in Mandarin).
const STORY_SEEDS: {
	title: string;
	contents: { subjectName: string; content: string }[];
	resource?: { label: string; fileName: string; text: string };
}[] = [
	{
		title: 'NHK news: 台風接近のニュース',
		contents: [
			{
				subjectName: 'Japanese',
				content:
					'台風接近のニュースの要約は次の通り。気象庁によると、大型で非常に強い台風が今週末にかけて日本列島に接近する見込みで、' +
					'特に太平洋側の広い範囲で大雨と暴風に警戒が必要だという。\n\n' +
					'すでに一部地域では風が強まり始めており、交通機関にも影響が出始めている。JRや私鉄各社は計画運休を検討していると発表し、' +
					'空の便にも欠航が相次ぐ可能性がある。\n\n' +
					'気象庁の担当者は、不要不急の外出を控えるとともに、河川の増水や土砂災害にも十分注意するよう呼びかけている。' +
					'台風の進路によっては、週明けにかけても天候が不安定な状態が続く見通しだという。\n\n' +
					'また、自治体によっては避難所の開設準備を始めているところもあり、今後の情報にも注意が必要だとしている。'
			},
			{
				subjectName: 'Mandarin',
				content:
					'关于台风逼近的新闻摘要如下。据气象厅介绍,一个大型且威力强劲的台风预计将在本周末逼近日本列岛,' +
					'尤其是太平洋沿岸的大范围地区需要警惕暴雨和强风。\n\n' +
					'部分地区的风力已经开始增强,交通也开始受到影响。JR和多家私营铁路公司表示正在考虑计划性停运,' +
					'航班也可能出现连续取消的情况。\n\n' +
					'气象厅的负责人呼吁民众尽量避免非必要的外出,同时要充分注意河流水位上涨和山体滑坡等次生灾害。' +
					'根据台风的路径,预计下周初天气仍可能持续不稳定。\n\n' +
					'此外,部分地方政府已经开始准备开设避难所,提醒民众持续关注后续的最新消息。'
			}
		],
		resource: {
			label: 'Original article text',
			fileName: 'nhk-typhoon-article.txt',
			text:
				'台風接近のニュース\n\n' +
				'気象庁は8日、週末にかけて大型で非常に強い台風が日本列島に接近する見込みだと発表した。' +
				'特に太平洋側の広い範囲では大雨と暴風による交通機関の乱れが予想されるとして、早めの備えを呼びかけている。\n\n' +
				'気象庁によると、この台風は今後さらに勢力を強めながら北上を続け、週末には関東から東海にかけての地域に最も接近する見通し。' +
				'伊豆諸島や紀伊半島などの沿岸部では、暴風とともに高波にも警戒が必要だという。\n\n' +
				'すでに影響は出始めており、JR各社や大手私鉄は計画運休を検討していることを明らかにした。航空各社も、' +
				'台風の進路次第では欠航が相次ぐ可能性があるとして、利用客に最新の運航情報を確認するよう呼びかけている。\n\n' +
				'気象庁の担当者は記者会見で「不要不急の外出は控え、河川の増水や土砂災害の前兆となる異変にも十分注意してほしい」と述べた。' +
				'また、自治体の中にはすでに避難所の開設準備を始めているところもあるという。\n\n' +
				'台風の進路や速度によっては、週明けにかけても広い範囲で天候が不安定な状態が続く可能性があり、' +
				'気象庁は今後の情報にも注意を続けるよう呼びかけている。'
		}
	},
	{
		title: 'Keigo job interview roleplay',
		contents: [
			{
				subjectName: 'Japanese',
				content:
					'A roleplay dialogue practicing 敬語 in a job-interview setting, covering a full opening exchange.\n\n' +
					'Interviewer: 「本日はお越しいただき、誠にありがとうございます。まず自己紹介をお願いできますでしょうか。」\n' +
					'Candidate: 「はい、よろしくお願いいたします。私は田中と申します。前職では営業部にて三年間、法人向けの提案業務を担当しておりました。」\n' +
					'Interviewer: 「ありがとうございます。前職で最も力を入れて取り組まれたことは何でしょうか。」\n' +
					'Candidate: 「お客様との信頼関係の構築に特に力を入れておりました。ご要望を丁寧に伺い、社内の関係部署と連携しながら、' +
					'最適な提案ができるよう努めておりました。」\n' +
					'Interviewer: 「なるほど。では、ご自身の強みについて教えていただけますでしょうか。」\n' +
					'Candidate: 「私の強みは、相手の立場に立って物事を考えられる点だと存じております。' +
					'お客様だけでなく、社内のメンバーに対しても同様に接することを心がけております。」\n\n' +
					'Notes: the interviewer consistently uses 尊敬語 forms (お越しいただき、教えていただけますでしょうか) ' +
					'while the candidate consistently uses 謙譲語 (申します、存じております、伺い) — practice keeping the two ' +
					'registers separate depending on whose action is being described.'
			}
		]
	},
	{
		title: 'Tone sandhi practice notes',
		contents: [
			{
				subjectName: 'Mandarin',
				content:
					'Working notes on 3rd-tone sandhi, collected across a few practice sessions.\n\n' +
					'Rule 1 — two 3rd tones in a row: when two 3rd-tone syllables meet, the first shifts to a 2nd tone in speech. ' +
					'你好 is said ní hǎo, not nǐ hǎo. 我很好 → 我 shifts to 2nd tone: wó hěn hǎo.\n\n' +
					'Rule 2 — three or more 3rd tones in a row: groups usually resolve by grammatical structure rather than ' +
					'strictly left-to-right. 我很好 already covered above; a longer chain like 我也很好 tends to break into ' +
					'(我也)(很好) → wó yě hén hǎo, both pairs shifting independently rather than one long cascade.\n\n' +
					'Practice sentences:\n' +
					'你也很好 — both 你 and 也 shift up since they lead into another 3rd tone.\n' +
					'我想买雨伞 — 我 and 想 both shift, since both are followed by another 3rd-tone syllable.\n' +
					'展览很小 — 展 shifts before 览, and 很 shifts before 小.\n\n' +
					'Common mistake to watch for: applying sandhi to isolated words read in citation form (e.g. reciting a ' +
					'vocabulary list) — the rule only applies when syllables are actually spoken in sequence within a phrase.'
			}
		]
	}
];

const seedFilesDir = join(dirname(process.env.DATABASE_URL!), 'files');
mkdirSync(seedFilesDir, { recursive: true });

await db.delete(storyResources);
await db.delete(files);
await db.delete(storyContent);
await db.delete(stories);
for (const seed of STORY_SEEDS) {
	const [story] = await db.insert(stories).values({ title: seed.title }).returning();

	await db.insert(storyContent).values(
		seed.contents.flatMap(({ subjectName, content }) => {
			const subject = subjectsByName.get(subjectName);
			if (!subject) return [];
			return [{ storyId: story.id, subjectId: subject.id, content }];
		})
	);

	if (seed.resource) {
		const path = join(seedFilesDir, seed.resource.fileName);
		writeFileSync(path, seed.resource.text, 'utf-8');
		const [file] = await db
			.insert(files)
			.values({
				path,
				mimeType: 'text/plain',
				sizeBytes: Buffer.byteLength(seed.resource.text, 'utf-8')
			})
			.returning();
		await db
			.insert(storyResources)
			.values({ storyId: story.id, fileId: file.id, label: seed.resource.label });
	}
}

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
	'Seeded agents, tools, subjects, agent_tools, agent_subagents, mistake_observations, study_topics, stories, story_content, files, story_resources, sessions and messages.'
);
client.close();
