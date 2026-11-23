CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listing_id` int NOT NULL,
	`shop_id` int NOT NULL,
	`buyer_id` int NOT NULL,
	`conversation_id` int,
	`title` varchar(120) NOT NULL,
	`unit_price_cents` int,
	`quantity` int NOT NULL DEFAULT 1,
	`note` varchar(500),
	`status` enum('pending','accepted','delivered','completed','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`delivered_at` timestamp,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contributions` ADD `order_id` int;--> statement-breakpoint
ALTER TABLE `listings` ADD `stock` int DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `orders_shop_idx` ON `orders` (`shop_id`,`status`);--> statement-breakpoint
CREATE INDEX `orders_buyer_idx` ON `orders` (`buyer_id`,`status`);--> statement-breakpoint
CREATE INDEX `orders_listing_idx` ON `orders` (`listing_id`);