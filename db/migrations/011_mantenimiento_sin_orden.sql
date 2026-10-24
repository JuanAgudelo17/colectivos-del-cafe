-- 011_mantenimiento_sin_orden.sql
-- Se quitan las reglas de orden del mantenimiento: el próximo cambio ya no tiene
-- que ser mayor que el kilometraje del registro ni con fecha posterior (se guarda
-- como se escriba). El orden del odómetro tampoco se valida ya en el backend.
-- Las restricciones no tenían nombre; se buscan por su definición.
DO $$
DECLARE
  restriccion record;
BEGIN
  FOR restriccion IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'mantenimiento'::regclass
       AND contype = 'c'
       AND (pg_get_constraintdef(oid) LIKE '%proximo_km > kilometraje%'
            OR pg_get_constraintdef(oid) LIKE '%proxima_fecha > fecha%')
  LOOP
    EXECUTE format('ALTER TABLE mantenimiento DROP CONSTRAINT %I', restriccion.conname);
  END LOOP;
END
$$;
