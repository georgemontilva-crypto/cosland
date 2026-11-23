ALTER TABLE `shops` ADD `support_badge` boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Insignia pedida por el administrador para su propia vitrina (no hace nada si ese enlace no existe)
UPDATE `shops` SET `support_badge` = true WHERE `handle` = 'pokestoreve';