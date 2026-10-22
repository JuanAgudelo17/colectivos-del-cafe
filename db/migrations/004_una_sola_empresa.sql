-- 004_una_sola_empresa.sql
-- El sistema es solo para Colectivos del Café: se elimina el soporte multi-empresa.
-- Al borrar cada columna empresa_id, Postgres borra también los índices,
-- restricciones y llaves foráneas que la incluían; aquí se recrean las que
-- siguen teniendo sentido sin empresa.

-- usuario: la FK compuesta (buseta_id, empresa_id) pasa a ser buseta_id simple.
ALTER TABLE usuario DROP COLUMN empresa_id CASCADE;
ALTER TABLE usuario
  ADD CONSTRAINT usuario_buseta_id_fkey FOREIGN KEY (buseta_id) REFERENCES buseta (id);

-- buseta: el número interno pasa a ser único en toda la flota.
ALTER TABLE buseta DROP COLUMN empresa_id CASCADE;
ALTER TABLE buseta
  ADD CONSTRAINT buseta_numero_interno_key UNIQUE (numero_interno);

-- parametro: una vigencia por clave.
ALTER TABLE parametro DROP COLUMN empresa_id CASCADE;
ALTER TABLE parametro
  ADD CONSTRAINT parametro_clave_vigente_desde_key UNIQUE (clave, vigente_desde);

DROP TABLE empresa;
