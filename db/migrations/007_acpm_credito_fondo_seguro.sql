-- 007_acpm_credito_fondo_seguro.sql
-- ACPM a crédito (bomba La Guaca), fondo de reposición fijo para busetas con
-- arriendo, seguro contractual (febrero a julio) y mantenimiento como ajuste del mes.

-- ACPM tanqueado a crédito en la bomba La Guaca: el conductor no lo paga (no se
-- le descuenta del efectivo del día); lo paga el dueño después. Para el neto
-- cuenta igual que el ACPM que paga el conductor.
ALTER TABLE producido_diario
  ADD COLUMN acpm_credito BIGINT NOT NULL DEFAULT 0 CHECK (acpm_credito >= 0);

-- Parámetros nuevos:
--   fondo_fijo_arriendo: fondo de reposición fijo para busetas sin cupo (con arriendo).
--                        Las que tienen cupo siguen con porcentaje_reposicion.
--   seguro_contractual:  valor mensual del seguro contractual; se descuenta solo
--                        de febrero a julio. Se carga cuando se conozca el valor.
ALTER TABLE parametro DROP CONSTRAINT parametro_clave_check;
ALTER TABLE parametro ADD CONSTRAINT parametro_clave_check
  CHECK (clave IN (
    'porcentaje_empresa', 'porcentaje_reposicion', 'sueldo_conductor', 'valor_relevo',
    'fondo_fijo_arriendo', 'seguro_contractual'
  ));

INSERT INTO parametro (clave, valor, vigente_desde) VALUES ('fondo_fijo_arriendo', 70000, '2026-01-01');

-- Mantenimiento como gasto del mes (además del mantenimiento por día).
ALTER TABLE ajuste_mensual DROP CONSTRAINT ajuste_mensual_tipo_check;
ALTER TABLE ajuste_mensual ADD CONSTRAINT ajuste_mensual_tipo_check
  CHECK (tipo IN ('bono', 'prestamo', 'mantenimiento'));
