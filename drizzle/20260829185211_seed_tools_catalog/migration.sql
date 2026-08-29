-- Custom SQL migration file, put your code below! -----
-- Populates the `tools` catalog table, which the initial schema migration only created empty.
-- These rows are code-tied (one per key in toolRegistry.ts's `registry`/`contextualRegistry`,
-- see src/lib/server/db/toolCatalog.ts), not example content, so — unlike agents/subjects/
-- sessions/etc — production needs them too, even though seed.ts (dev-only, destructive) never
-- runs here. `ON CONFLICT DO NOTHING` is defense-in-depth only; drizzle-kit's own migration
-- bookkeeping already ensures this file runs at most once per database.
--
-- Adding or removing a tool later: update toolCatalog.ts (for dev's seed.ts), then add a new
-- migration here inserting/deleting just that row — this file is a one-time historical snapshot,
-- not something to edit after the fact.
INSERT INTO `tools` (`id`, `name`, `is_subject_required`, `createdAt`, `updated_at`) VALUES
	('713d86f3-fab6-4ad2-891d-fd6c22b56ee4', 'current_time_tool', false, (unixepoch() * 1000), (unixepoch() * 1000)),
	('36236fe2-be95-4e92-93cc-15234fef9a5f', 'fetch_url', false, (unixepoch() * 1000), (unixepoch() * 1000)),
	('41dad812-e736-4420-9c0d-3590e2373f41', 'get_decks', false, (unixepoch() * 1000), (unixepoch() * 1000)),
	('db182497-c75a-40f3-b2e7-4630397bbc99', 'add_note', false, (unixepoch() * 1000), (unixepoch() * 1000)),
	('5d24f579-de66-45d7-b7c6-bfcbcdb12f65', 'add_sentence_note', false, (unixepoch() * 1000), (unixepoch() * 1000)),
	('430e7fe9-64dd-4d4a-9cc7-e3ec4f1738de', 'find', false, (unixepoch() * 1000), (unixepoch() * 1000)),
	('aac92026-82b4-4d99-a086-8566f4251039', 'get_note_types', false, (unixepoch() * 1000), (unixepoch() * 1000)),
	('65d78f92-da18-4592-8e91-5497077eea86', 'get_note_info', false, (unixepoch() * 1000), (unixepoch() * 1000)),
	('e542bfbe-48a9-4111-86f6-0a4162da18d7', 'cards_info', false, (unixepoch() * 1000), (unixepoch() * 1000)),
	('baf8712a-7b0d-4b00-9ee1-736077a54f08', 'get_intervals', false, (unixepoch() * 1000), (unixepoch() * 1000)),
	('8d5a3509-4612-40e4-9739-12b4eac8f5cc', 'save_memory', false, (unixepoch() * 1000), (unixepoch() * 1000)),
	('d60328bb-b8fa-4f46-a5fb-7c81680a83b4', 'delete_memory', false, (unixepoch() * 1000), (unixepoch() * 1000)),
	('09dd364b-7dba-4f85-aa2f-6ab0b0ba8e62', 'create_topic', true, (unixepoch() * 1000), (unixepoch() * 1000)),
	('2bd16882-72ff-4f5c-933f-2ace138ae3dc', 'update_topic', false, (unixepoch() * 1000), (unixepoch() * 1000)),
	('dca161e6-d393-4fd7-95eb-acf0eea59f44', 'create_mistake', true, (unixepoch() * 1000), (unixepoch() * 1000)),
	('c4fa04f4-ab45-4ff8-add4-2a2cadb686a3', 'update_mistake', false, (unixepoch() * 1000), (unixepoch() * 1000)),
	('1ab5dc7e-2cc2-4c0d-a276-002f5018d290', 'save_story', false, (unixepoch() * 1000), (unixepoch() * 1000)),
	('1d060453-34e9-4337-9c9d-4850d63c971e', 'present_quiz', false, (unixepoch() * 1000), (unixepoch() * 1000))
ON CONFLICT (`name`) DO NOTHING;
