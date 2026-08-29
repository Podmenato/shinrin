// The fixed set of internal-agent tools, one row per key in toolRegistry.ts's `registry` +
// `contextualRegistry`. Single source of truth for seed.ts's dev insert — production gets these
// rows from a committed data migration instead (drizzle/*_seed_tools_catalog), since prod never
// runs seed.ts (see that file's own comment on why). When adding or removing a tool here, also
// add a new migration for it (`pnpm exec drizzle-kit generate --custom --config
// drizzle.config.prod.ts`, then hand-write the INSERT) — this array alone never reaches
// production.
export const TOOL_CATALOG: { name: string; isSubjectRequired?: true }[] = [
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
	{ name: 'present_quiz' }
];
