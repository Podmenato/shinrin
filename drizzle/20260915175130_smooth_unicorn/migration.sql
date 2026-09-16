CREATE TABLE `models` (
	`id` text PRIMARY KEY,
	`provider_id` text NOT NULL,
	`name` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_models_provider_id_providers_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`),
	CONSTRAINT `models_provider_id_name_unique` UNIQUE(`provider_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`createdAt` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `agents` ADD `default_model_id` text REFERENCES models(id);--> statement-breakpoint
ALTER TABLE `quick_asks` ADD `model_id` text REFERENCES models(id);--> statement-breakpoint
ALTER TABLE `sessions` ADD `model_id` text REFERENCES models(id);