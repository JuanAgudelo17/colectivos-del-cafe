-- 009_entregas_colpass.sql
-- Las liquidaciones del Colpass pasan a ser ENTREGAS de plata: el conductor (o el
-- admin) registra cuánto le entregó al propietario y en qué fecha, y queda
-- liquidado de una vez. Qué días cubre cada entrega se calcula en orden (los
-- peajes más viejos primero), así que el rango desde/hasta ya no se guarda.

ALTER TABLE liquidacion_peaje ADD COLUMN fecha DATE;
UPDATE liquidacion_peaje SET fecha = hasta;
ALTER TABLE liquidacion_peaje ALTER COLUMN fecha SET NOT NULL;

-- Al quitar las columnas se van también el CHECK (desde <= hasta) y su índice.
ALTER TABLE liquidacion_peaje DROP COLUMN desde, DROP COLUMN hasta;
ALTER TABLE liquidacion_peaje ADD CONSTRAINT liquidacion_peaje_valor_positivo CHECK (valor > 0);

CREATE INDEX liquidacion_peaje_buseta_fecha_idx ON liquidacion_peaje (buseta_id, fecha, id);
