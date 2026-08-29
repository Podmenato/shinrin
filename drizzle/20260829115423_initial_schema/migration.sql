CREATE TABLE `agent_subagents` (
	`agent_id` text NOT NULL,
	`subagent_id` text NOT NULL,
	CONSTRAINT `agent_subagents_pk` PRIMARY KEY(`agent_id`, `subagent_id`),
	CONSTRAINT `fk_agent_subagents_agent_id_agents_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`),
	CONSTRAINT `fk_agent_subagents_subagent_id_agents_id_fk` FOREIGN KEY (`subagent_id`) REFERENCES `agents`(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_tools` (
	`agent_id` text NOT NULL,
	`tool_id` text NOT NULL,
	CONSTRAINT `agent_tools_pk` PRIMARY KEY(`agent_id`, `tool_id`),
	CONSTRAINT `fk_agent_tools_agent_id_agents_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`),
	CONSTRAINT `fk_agent_tools_tool_id_tools_id_fk` FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`system_prompt` text,
	`is_subagent` integer DEFAULT false NOT NULL,
	`subagent_description` text,
	`default_model` text,
	`subject_id` text,
	`deleted_at` integer,
	`createdAt` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_agents_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`)
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY,
	`path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memories` (
	`id` text PRIMARY KEY,
	`agent_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`deleted_at` integer,
	`createdAt` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_memories_agent_id_agents_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`),
	CONSTRAINT `memories_agent_id_key_unique` UNIQUE(`agent_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `message_tool_calls` (
	`id` text PRIMARY KEY,
	`message_id` text NOT NULL,
	`tool_id` text NOT NULL,
	`args` text,
	CONSTRAINT `fk_message_tool_calls_message_id_messages_id_fk` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_message_tool_calls_tool_id_tools_id_fk` FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`tool_name` text,
	`createdAt` integer NOT NULL,
	CONSTRAINT `fk_messages_session_id_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `mistake_observations` (
	`id` text PRIMARY KEY,
	`subject_id` text NOT NULL,
	`title` text NOT NULL,
	`note` text NOT NULL,
	`createdAt` integer NOT NULL,
	CONSTRAINT `fk_mistake_observations_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`)
);
--> statement-breakpoint
CREATE TABLE `quick_asks` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`agent_id` text NOT NULL,
	`model` text NOT NULL,
	`deck` text NOT NULL,
	`state` text NOT NULL,
	`days` integer,
	`prompt` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_quick_asks_agent_id_agents_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY,
	`agent_id` text NOT NULL,
	`name` text NOT NULL,
	`model` text NOT NULL,
	`system_prompt` text,
	`summary` text,
	`parent_session_id` text,
	`summarized_through_message_id` text,
	`createdAt` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_sessions_agent_id_agents_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`),
	CONSTRAINT `fk_sessions_parent_session_id_sessions_id_fk` FOREIGN KEY (`parent_session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_sessions_summarized_through_message_id_messages_id_fk` FOREIGN KEY (`summarized_through_message_id`) REFERENCES `messages`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `story_content` (
	`id` text PRIMARY KEY,
	`story_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`content` text NOT NULL,
	`stale` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_story_content_story_id_stories_id_fk` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`),
	CONSTRAINT `fk_story_content_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`),
	CONSTRAINT `story_content_story_id_subject_id_unique` UNIQUE(`story_id`,`subject_id`)
);
--> statement-breakpoint
CREATE TABLE `story_resources` (
	`id` text PRIMARY KEY,
	`story_id` text NOT NULL,
	`file_id` text NOT NULL,
	`label` text,
	`createdAt` integer NOT NULL,
	CONSTRAINT `fk_story_resources_story_id_stories_id_fk` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`),
	CONSTRAINT `fk_story_resources_file_id_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `files`(`id`)
);
--> statement-breakpoint
CREATE TABLE `study_topics` (
	`id` text PRIMARY KEY,
	`subject_id` text NOT NULL,
	`topic` text NOT NULL,
	`status` text NOT NULL,
	`notes` text,
	`createdAt` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_study_topics_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`),
	CONSTRAINT `study_topics_subject_id_topic_unique` UNIQUE(`subject_id`,`topic`)
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`description` text,
	`reading_deck` text,
	`production_deck` text,
	`listening_deck` text,
	`auto_add_agent_id` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_subjects_auto_add_agent_id_agents_id_fk` FOREIGN KEY (`auto_add_agent_id`) REFERENCES `agents`(`id`)
);
--> statement-breakpoint
CREATE TABLE `tools` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`is_subject_required` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updated_at` integer NOT NULL
);
