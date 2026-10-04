-- Links each tool result (`messages` row with role 'tool') to the exact call it answers, and makes
-- `message_tool_calls` able to record every call the model made, not just built-in tools:
--   - message_tool_calls: + `name` (verbatim, NOT NULL), + `provider_call_id`, `tool_id` nullable
--   - messages: + `tool_call_id` (FK → message_tool_calls.id)
--
-- The table rebuild is what `drizzle-kit generate` produced for this diff, with two hand edits:
-- its separate `ALTER TABLE message_tool_calls ADD name text NOT NULL` dropped (SQLite rejects a
-- NOT NULL column with no default, and the rebuild adds the column anyway), and its INSERT ... SELECT
-- filling `name` from `tools` — every existing row has a `tool_id` (it was NOT NULL with an FK until
-- now), so an inner join loses nothing.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_message_tool_calls` (
	`id` text PRIMARY KEY,
	`message_id` text NOT NULL,
	`name` text NOT NULL,
	`provider_call_id` text,
	`tool_id` text,
	`args` text,
	CONSTRAINT `fk_message_tool_calls_message_id_messages_id_fk` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_message_tool_calls_tool_id_tools_id_fk` FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_message_tool_calls`(`id`, `message_id`, `name`, `tool_id`, `args`)
SELECT `message_tool_calls`.`id`, `message_tool_calls`.`message_id`, `tools`.`name`, `message_tool_calls`.`tool_id`, `message_tool_calls`.`args`
FROM `message_tool_calls`
INNER JOIN `tools` ON `tools`.`id` = `message_tool_calls`.`tool_id`
ORDER BY `message_tool_calls`.`rowid`;--> statement-breakpoint
DROP TABLE `message_tool_calls`;--> statement-breakpoint
ALTER TABLE `__new_message_tool_calls` RENAME TO `message_tool_calls`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `messages` ADD `tool_call_id` text REFERENCES message_tool_calls(id) ON DELETE CASCADE;--> statement-breakpoint

-- Backfill: until now a result was tied to its call only implicitly — agent.run() saves an
-- assistant message, its calls, then one `tool` message per executed call, in call order. So a
-- result's call is: in the nearest assistant message before it (same session), the Nth call with
-- the same name, where the result is the Nth result with that name after that assistant message.
-- `rowid` is insertion order for both tables (the rebuild above preserves it via ORDER BY), which is
-- also the order agent.run() wrote them in; `createdAt` isn't used because rows written in the same
-- millisecond would tie.
--
-- Results with no matching call stay NULL: old subagent results, whose call was never saved
-- (ContextManager.add() only saved calls to built-in tools), and results of calls to unknown tools
-- (never saved either). Both are dropped on replay, as before.
WITH `tool_results` AS (
	SELECT
		`m`.`id`,
		`m`.`rowid` AS `rn`,
		`m`.`tool_name`,
		(
			SELECT `a`.`id` FROM `messages` `a`
			WHERE `a`.`session_id` = `m`.`session_id` AND `a`.`role` = 'assistant' AND `a`.`rowid` < `m`.`rowid`
			ORDER BY `a`.`rowid` DESC
			LIMIT 1
		) AS `assistant_id`
	FROM `messages` `m`
	WHERE `m`.`role` = 'tool'
),
`ranked_results` AS (
	SELECT `id`, `tool_name`, `assistant_id`,
		ROW_NUMBER() OVER (PARTITION BY `assistant_id`, `tool_name` ORDER BY `rn`) AS `n`
	FROM `tool_results`
	WHERE `assistant_id` IS NOT NULL
),
`ranked_calls` AS (
	SELECT `id`, `message_id`, `name`,
		ROW_NUMBER() OVER (PARTITION BY `message_id`, `name` ORDER BY `rowid`) AS `n`
	FROM `message_tool_calls`
)
UPDATE `messages`
SET `tool_call_id` = (
	SELECT `c`.`id`
	FROM `ranked_results` `r`
	INNER JOIN `ranked_calls` `c`
		ON `c`.`message_id` = `r`.`assistant_id` AND `c`.`name` = `r`.`tool_name` AND `c`.`n` = `r`.`n`
	WHERE `r`.`id` = `messages`.`id`
)
WHERE `role` = 'tool';
