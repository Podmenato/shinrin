-- Custom SQL migration file, put your code below! -----
-- Backfills the new `providers`/`models` tables (added empty by the previous migration) from
-- existing `sessions.model` / `quick_asks.model` / `agents.default_model` string data, points the
-- new `*_id` FK columns at the backfilled rows, then — now that every row has one — drops the old
-- text columns and tightens `sessions.model_id`/`quick_asks.model_id` to NOT NULL. Every session/
-- quick-ask/agent that has ever existed only ran on Ollama (the only provider that has ever been
-- registered), so backfilling against a single fixed `providers` row is safe — this is historical
-- data, not a live decision.
--
-- The table-rebuild statements below (`__new_quick_asks`/`__new_sessions`) are hand-copied from
-- what `drizzle-kit generate` itself produces for this exact column-tightening diff — verified by
-- generating it standalone first, then folding its output in here rather than retyping it by hand.
-- Kept in this same custom file (not a separate generated migration) so drizzle-kit's own
-- bookkeeping only sees two migrations total for this change — the tool can't auto-generate the
-- backfill regardless, so there's no benefit to splitting the schema-only parts across additional
-- generated files around it.
--
-- `ON CONFLICT ... DO NOTHING` throughout is defense-in-depth only, same as seed_tools_catalog —
-- drizzle-kit's own bookkeeping already ensures this file runs at most once per database.
INSERT INTO `providers` (`id`, `name`, `createdAt`, `updated_at`) VALUES
	('6ada1ed7-aebc-4461-901f-05d35aaf36da', 'ollama', (unixepoch() * 1000), (unixepoch() * 1000))
ON CONFLICT (`name`) DO NOTHING;
--> statement-breakpoint

INSERT INTO `models` (`id`, `provider_id`, `name`, `createdAt`, `updated_at`)
SELECT
	lower(hex(randomblob(4))) || '-' ||
		lower(hex(randomblob(2))) || '-4' ||
		substr(lower(hex(randomblob(2))), 2) || '-' ||
		substr('89ab', abs(random()) % 4 + 1, 1) ||
		substr(lower(hex(randomblob(2))), 2) || '-' ||
		lower(hex(randomblob(6))),
	'6ada1ed7-aebc-4461-901f-05d35aaf36da',
	model_name,
	(unixepoch() * 1000),
	(unixepoch() * 1000)
FROM (
	SELECT `model` AS model_name FROM `sessions` WHERE `model` IS NOT NULL
	UNION
	SELECT `model` AS model_name FROM `quick_asks` WHERE `model` IS NOT NULL
	UNION
	SELECT `default_model` AS model_name FROM `agents` WHERE `default_model` IS NOT NULL
)
-- Redundant (the three legs above already filter nulls) but required: a bare `FROM (subquery)`
-- directly followed by `ON CONFLICT` is ambiguous to SQLite's parser (reads like a dropped
-- `JOIN ... ON`) and fails with "near DO: syntax error" — confirmed directly against the
-- installed node:sqlite (3.53.3) before settling on this fix. A WHERE clause disambiguates it.
WHERE model_name IS NOT NULL
ON CONFLICT (`provider_id`, `name`) DO NOTHING;
--> statement-breakpoint

UPDATE `sessions`
SET `model_id` = (
	SELECT `id` FROM `models`
	WHERE `provider_id` = '6ada1ed7-aebc-4461-901f-05d35aaf36da' AND `name` = `sessions`.`model`
)
WHERE `model_id` IS NULL;
--> statement-breakpoint

UPDATE `quick_asks`
SET `model_id` = (
	SELECT `id` FROM `models`
	WHERE `provider_id` = '6ada1ed7-aebc-4461-901f-05d35aaf36da' AND `name` = `quick_asks`.`model`
)
WHERE `model_id` IS NULL;
--> statement-breakpoint

UPDATE `agents`
SET `default_model_id` = (
	SELECT `id` FROM `models`
	WHERE `provider_id` = '6ada1ed7-aebc-4461-901f-05d35aaf36da' AND `name` = `agents`.`default_model`
)
WHERE `default_model` IS NOT NULL AND `default_model_id` IS NULL;
--> statement-breakpoint

PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_quick_asks` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`agent_id` text NOT NULL,
	`model_id` text NOT NULL,
	`deck` text NOT NULL,
	`state` text NOT NULL,
	`days` integer,
	`prompt` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_quick_asks_agent_id_agents_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`),
	CONSTRAINT `fk_quick_asks_model_id_models_id_fk` FOREIGN KEY (`model_id`) REFERENCES `models`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_quick_asks`(`id`, `name`, `agent_id`, `model_id`, `deck`, `state`, `days`, `prompt`, `createdAt`, `updated_at`) SELECT `id`, `name`, `agent_id`, `model_id`, `deck`, `state`, `days`, `prompt`, `createdAt`, `updated_at` FROM `quick_asks`;--> statement-breakpoint
DROP TABLE `quick_asks`;--> statement-breakpoint
ALTER TABLE `__new_quick_asks` RENAME TO `quick_asks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` text PRIMARY KEY,
	`agent_id` text NOT NULL,
	`name` text NOT NULL,
	`model_id` text NOT NULL,
	`system_prompt` text,
	`summary` text,
	`parent_session_id` text,
	`summarized_through_message_id` text,
	`createdAt` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_sessions_agent_id_agents_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`),
	CONSTRAINT `fk_sessions_model_id_models_id_fk` FOREIGN KEY (`model_id`) REFERENCES `models`(`id`),
	CONSTRAINT `fk_sessions_parent_session_id_sessions_id_fk` FOREIGN KEY (`parent_session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_sessions_summarized_through_message_id_messages_id_fk` FOREIGN KEY (`summarized_through_message_id`) REFERENCES `messages`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_sessions`(`id`, `agent_id`, `name`, `model_id`, `system_prompt`, `summary`, `parent_session_id`, `summarized_through_message_id`, `createdAt`, `updated_at`) SELECT `id`, `agent_id`, `name`, `model_id`, `system_prompt`, `summary`, `parent_session_id`, `summarized_through_message_id`, `createdAt`, `updated_at` FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `agents` DROP COLUMN `default_model`;
