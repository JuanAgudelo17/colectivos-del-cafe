-- 012_cierre_por_liquidacion.sql
-- Un mes se puede cerrar con la LIQUIDACIÓN MENSUAL que entrega la cooperativa
-- (el documento "Liquidación mensual de vehículos"), aunque no haya días
-- registrados en el producido. Esos valores mandan para ese mes en Producido,
-- Mi producido, Rentabilidad y Ranking.

ALTER TABLE cierre_mensual
  ADD COLUMN polizas     BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN prestamos   BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN relevo      BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN bono        BIGINT NOT NULL DEFAULT 0,
  -- calculado = cierre de la app (fase 3); liquidacion = digitado de la cooperativa
  ADD COLUMN origen      TEXT   NOT NULL DEFAULT 'calculado' CHECK (origen IN ('calculado', 'liquidacion')),
  -- Las líneas del documento tal como vienen (para mostrarlo igual).
  ADD COLUMN liquidacion JSONB;
