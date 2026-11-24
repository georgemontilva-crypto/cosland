CREATE TABLE `device_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`token` varchar(500) NOT NULL,
	`platform` varchar(12) NOT NULL DEFAULT 'android',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `device_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `device_token_idx` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE INDEX `device_user_idx` ON `device_tokens` (`user_id`);