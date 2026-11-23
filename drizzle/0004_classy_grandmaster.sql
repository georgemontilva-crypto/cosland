CREATE TABLE `shop_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shop_id` int NOT NULL,
	`type` varchar(30) NOT NULL,
	`details` varchar(600) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shop_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `pay_method_id` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `pay_label` varchar(60);--> statement-breakpoint
ALTER TABLE `orders` ADD `pay_status` enum('unpaid','reported','confirmed','on_delivery') DEFAULT 'on_delivery' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `pay_reference` varchar(120);--> statement-breakpoint
ALTER TABLE `orders` ADD `pay_proof_url` varchar(500);--> statement-breakpoint
ALTER TABLE `orders` ADD `paid_at` timestamp;--> statement-breakpoint
ALTER TABLE `shops` ADD `pay_on_delivery` boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `shop_payments_shop_idx` ON `shop_payments` (`shop_id`);