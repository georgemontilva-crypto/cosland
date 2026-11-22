CREATE TABLE `contributions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shop_id` int NOT NULL,
	`listing_id` int,
	`amount_cents` int NOT NULL DEFAULT 100,
	`status` enum('pending','reported','confirmed','dismissed') NOT NULL DEFAULT 'pending',
	`reference` varchar(120),
	`proof_url` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`reported_at` timestamp,
	`confirmed_at` timestamp,
	CONSTRAINT `contributions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`setting_key` varchar(60) NOT NULL,
	`value` text NOT NULL,
	CONSTRAINT `settings_setting_key` PRIMARY KEY(`setting_key`)
);
--> statement-breakpoint
ALTER TABLE `listings` ADD `supports_app` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `contrib_shop_idx` ON `contributions` (`shop_id`,`status`);--> statement-breakpoint
CREATE INDEX `contrib_status_idx` ON `contributions` (`status`,`confirmed_at`);