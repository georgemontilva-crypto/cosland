CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`buyer_id` int NOT NULL,
	`shop_id` int NOT NULL,
	`last_body` varchar(200),
	`last_at` timestamp NOT NULL DEFAULT (now()),
	`buyer_unread` int NOT NULL DEFAULT 0,
	`seller_unread` int NOT NULL DEFAULT 0,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `conv_pair_idx` UNIQUE(`buyer_id`,`shop_id`)
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`user_id` int NOT NULL,
	`listing_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favorites_user_id_listing_id_pk` PRIMARY KEY(`user_id`,`listing_id`)
);
--> statement-breakpoint
CREATE TABLE `follows` (
	`user_id` int NOT NULL,
	`shop_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `follows_user_id_shop_id_pk` PRIMARY KEY(`user_id`,`shop_id`)
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shop_id` int NOT NULL,
	`kind` enum('product','service') NOT NULL DEFAULT 'product',
	`deal` enum('venta','alquiler','encargo') NOT NULL DEFAULT 'venta',
	`category` varchar(40) NOT NULL,
	`title` varchar(120) NOT NULL,
	`description` text NOT NULL,
	`price_cents` int,
	`accepts_trade` boolean NOT NULL DEFAULT false,
	`item_condition` enum('nuevo','como_nuevo','usado','hecho_a_mano'),
	`size` varchar(30),
	`measurements` varchar(255),
	`series` varchar(100),
	`character_name` varchar(100),
	`delivery` enum('personal','envio','ambos') NOT NULL DEFAULT 'ambos',
	`images` text NOT NULL,
	`status` enum('active','paused','sold','removed') NOT NULL DEFAULT 'active',
	`featured` boolean NOT NULL DEFAULT false,
	`views` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `listings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversation_id` int NOT NULL,
	`sender_id` int NOT NULL,
	`body` text NOT NULL,
	`listing_id` int,
	`offer_cents` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reporter_id` int NOT NULL,
	`listing_id` int NOT NULL,
	`reason` varchar(120) NOT NULL,
	`detail` text,
	`status` enum('open','resolved') NOT NULL DEFAULT 'open',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shop_id` int NOT NULL,
	`author_id` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `reviews_pair_idx` UNIQUE(`shop_id`,`author_id`)
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`handle` varchar(40) NOT NULL,
	`name` varchar(80) NOT NULL,
	`kind` enum('cosplayer','taller','tienda','coleccionista','artista','fotografo') NOT NULL DEFAULT 'cosplayer',
	`bio` text,
	`avatar_url` varchar(500),
	`banner_url` varchar(500),
	`accent` enum('sakura','matcha','ramune','fuji','yuzu','momo') NOT NULL DEFAULT 'sakura',
	`city` varchar(80),
	`country` varchar(60),
	`whatsapp` varchar(30),
	`instagram` varchar(60),
	`tiktok` varchar(60),
	`has_store` boolean NOT NULL DEFAULT false,
	`address` varchar(255),
	`hours` varchar(255),
	`verified` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shops_id` PRIMARY KEY(`id`),
	CONSTRAINT `shops_handle_idx` UNIQUE(`handle`),
	CONSTRAINT `shops_user_idx` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(190) NOT NULL,
	`password_hash` varchar(100) NOT NULL,
	`name` varchar(80) NOT NULL,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`banned` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_idx` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `wanted` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`title` varchar(120) NOT NULL,
	`description` text,
	`category` varchar(40) NOT NULL,
	`budget_cents` int,
	`size` varchar(30),
	`city` varchar(80),
	`contact` varchar(120),
	`status` enum('open','closed','removed') NOT NULL DEFAULT 'open',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wanted_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `conv_shop_idx` ON `conversations` (`shop_id`);--> statement-breakpoint
CREATE INDEX `follows_shop_idx` ON `follows` (`shop_id`);--> statement-breakpoint
CREATE INDEX `listings_shop_idx` ON `listings` (`shop_id`);--> statement-breakpoint
CREATE INDEX `listings_browse_idx` ON `listings` (`status`,`category`,`created_at`);--> statement-breakpoint
CREATE INDEX `msg_conv_idx` ON `messages` (`conversation_id`,`id`);--> statement-breakpoint
CREATE INDEX `wanted_status_idx` ON `wanted` (`status`,`created_at`);