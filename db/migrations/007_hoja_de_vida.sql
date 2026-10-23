-- 007_hoja_de_vida.sql
-- Hoja de vida de cada buseta: foto, documentos legales con vencimiento,
-- lecturas del odómetro y el historial de mantenimientos.

-- Foto de la buseta: ruta dentro del bucket privado "busetas" (solo la sube el admin).
ALTER TABLE buseta ADD COLUMN foto_path TEXT;

-- Documentos legales del transporte público, con la misma alerta de ≤ 30 días
-- que el SOAT y la tecnomecánica. Solo los edita el admin.
ALTER TABLE documento_buseta
  ADD COLUMN fecha_tarjeta_operacion DATE,
  ADD COLUMN fecha_poliza_rcc        DATE,  -- responsabilidad civil contractual
  ADD COLUMN fecha_poliza_rce        DATE,  -- responsabilidad civil extracontractual
  ADD COLUMN fecha_extintor          DATE;  -- vencimiento de la recarga

-- Tipos de mantenimiento y cada cuánto toca. Igual que `ruta`, solo sirven para
-- PROPONER el próximo cambio al registrar uno; lo guardado en `mantenimiento`
-- son los valores finales (editables). Cambiar un intervalo no altera registros
-- ya hechos. Valores iniciales por confirmar con el mecánico.
CREATE TABLE tipo_mantenimiento (
  clave            TEXT     PRIMARY KEY,
  nombre           TEXT     NOT NULL,
  intervalo_km     INTEGER  CHECK (intervalo_km > 0),
  intervalo_meses  SMALLINT CHECK (intervalo_meses > 0),
  orden            SMALLINT NOT NULL,
  activo           BOOLEAN  NOT NULL DEFAULT TRUE
);

INSERT INTO tipo_mantenimiento (clave, nombre, intervalo_km, intervalo_meses, orden) VALUES
  ('aceite',              'Cambio de aceite',               5000,  3,    1),
  ('filtro_aceite',       'Filtro de aceite',               5000,  3,    2),
  ('filtro_aire',         'Filtro de aire',                 10000, 6,    3),
  ('filtro_combustible',  'Filtro de combustible',          10000, 6,    4),
  ('correas',             'Correas',                        40000, 12,   5),
  ('frenos',              'Frenos (pastillas o bandas)',    20000, NULL, 6),
  ('llantas',             'Llantas (cambio o rotación)',    10000, NULL, 7),
  ('alineacion',          'Alineación y balanceo',          10000, 6,    8),
  ('bateria',             'Batería',                        NULL,  24,   9),
  ('revision_preventiva', 'Revisión preventiva',            NULL,  2,    10),
  ('otro',                'Otro',                           NULL,  NULL, 11);

-- Lecturas del odómetro que reporta el conductor (o el admin). Una por día:
-- reportar otra vez el mismo día la corrige.
CREATE TABLE lectura_kilometraje (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  buseta_id       BIGINT      NOT NULL REFERENCES buseta (id),
  fecha           DATE        NOT NULL,
  kilometraje     INTEGER     NOT NULL CHECK (kilometraje BETWEEN 0 AND 9999999),
  registrado_por  BIGINT      NOT NULL REFERENCES usuario (id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (buseta_id, fecha)
);

-- Historial de mantenimientos. El "último" de cada tipo es el más reciente; el
-- próximo (por km y/o fecha) se propone con el intervalo del tipo.
CREATE TABLE mantenimiento (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  buseta_id       BIGINT      NOT NULL REFERENCES buseta (id),
  tipo            TEXT        NOT NULL REFERENCES tipo_mantenimiento (clave),
  fecha           DATE        NOT NULL,
  kilometraje     INTEGER     CHECK (kilometraje BETWEEN 0 AND 9999999),
  proximo_km      INTEGER     CHECK (proximo_km BETWEEN 0 AND 9999999),
  proxima_fecha   DATE,
  observacion     TEXT,
  registrado_por  BIGINT      NOT NULL REFERENCES usuario (id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (proximo_km IS NULL OR kilometraje IS NULL OR proximo_km > kilometraje),
  CHECK (proxima_fecha IS NULL OR proxima_fecha > fecha)
);

CREATE INDEX mantenimiento_buseta_tipo_fecha_idx ON mantenimiento (buseta_id, tipo, fecha DESC);

ALTER TABLE tipo_mantenimiento  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lectura_kilometraje ENABLE ROW LEVEL SECURITY;
ALTER TABLE mantenimiento       ENABLE ROW LEVEL SECURITY;
