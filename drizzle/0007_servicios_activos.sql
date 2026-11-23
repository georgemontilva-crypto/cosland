-- Los servicios y lo que se hace por encargo o se alquila no se agotan: una venta no los cierra.
-- Vuelven a publicarse los que quedaron como "vendido" por el botón de anotar una venta.
UPDATE `listings` SET `status` = 'active' WHERE `status` = 'sold' AND NOT (`kind` = 'product' AND `deal` = 'venta');
