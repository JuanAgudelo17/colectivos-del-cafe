-- 006_producido.sql
-- Registro del producido diario: relevo por día, rutas con sus tarifas (para
-- proponer peajes y salidas según las vueltas) y ajustes del mes (bono, préstamos).

-- Relevo: el conductor descansa y un reemplazo trabaja la buseta. Cada día de
-- relevo cuesta `valor_relevo` (parámetro con vigencia).
ALTER TABLE producido_diario
  ADD COLUMN relevo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE parametro DROP CONSTRAINT parametro_clave_check;
ALTER TABLE parametro ADD CONSTRAINT parametro_clave_check
  CHECK (clave IN ('porcentaje_empresa', 'porcentaje_reposicion', 'sueldo_conductor', 'valor_relevo'));

INSERT INTO parametro (clave, valor, vigente_desde) VALUES ('valor_relevo', 132000, '2026-01-01');

-- Rutas y sus tarifas. Solo sirven para proponer peajes y salidas a partir de
-- las vueltas del día; lo que se guarda en producido_diario son los valores
-- finales (que el admin puede corregir). Cambiar una tarifa no altera días ya
-- registrados.
--   vuelta = 2 × peaje_trayecto + salida_ida + salida_regreso
CREATE TABLE ruta (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre          TEXT    NOT NULL UNIQUE,
  peaje_trayecto  BIGINT  NOT NULL CHECK (peaje_trayecto >= 0),
  salida_ida      BIGINT  NOT NULL DEFAULT 0 CHECK (salida_ida >= 0),
  salida_regreso  BIGINT  NOT NULL DEFAULT 0 CHECK (salida_regreso >= 0),
  activo          BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO ruta (nombre, peaje_trayecto, salida_ida, salida_regreso) VALUES
  ('Pereira – Cartago',   21200, 7100,  0),
  ('Pereira – Manizales', 23500, 14100, 17100);

-- Ajustes del mes por buseta que no son diarios: bono (opcional) y préstamos.
-- Ambos restan del neto. Puede haber varios por mes.
CREATE TABLE ajuste_mensual (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  buseta_id    BIGINT      NOT NULL REFERENCES buseta (id),
  anio         SMALLINT    NOT NULL CHECK (anio BETWEEN 2020 AND 2100),
  mes          SMALLINT    NOT NULL CHECK (mes BETWEEN 1 AND 12),
  tipo         TEXT        NOT NULL CHECK (tipo IN ('bono', 'prestamo')),
  descripcion  TEXT,
  valor        BIGINT      NOT NULL CHECK (valor > 0),
  creado_por   BIGINT      NOT NULL REFERENCES usuario (id),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ajuste_mensual_buseta_mes_idx ON ajuste_mensual (buseta_id, anio, mes);

ALTER TABLE ruta           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ajuste_mensual ENABLE ROW LEVEL SECURITY;
