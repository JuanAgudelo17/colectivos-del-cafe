-- 015_planillas.sql
-- Planillas de despacho (los tiquetes de cada salida): el admin las digita una
-- por una y el día de la cuadrícula toma de su suma el producido (valor), los
-- peajes y las salidas. Una vuelta son dos planillas (ida y regreso).
CREATE TABLE planilla (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  buseta_id    BIGINT      NOT NULL REFERENCES buseta (id),
  fecha        DATE        NOT NULL,
  ruta_id      BIGINT      REFERENCES ruta (id),
  sentido      TEXT        NOT NULL DEFAULT 'ida' CHECK (sentido IN ('ida', 'regreso')),
  -- Solo los dígitos, sin ceros a la izquierda ("P00000000366926" → "366926").
  consecutivo  TEXT,
  valor        BIGINT      NOT NULL CHECK (valor > 0),
  peaje        BIGINT      NOT NULL DEFAULT 0 CHECK (peaje >= 0),
  salida       BIGINT      NOT NULL DEFAULT 0 CHECK (salida >= 0),
  creado_por   BIGINT      NOT NULL REFERENCES usuario (id),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- La misma planilla no se digita dos veces en una buseta.
CREATE UNIQUE INDEX planilla_consecutivo_unico ON planilla (buseta_id, consecutivo) WHERE consecutivo IS NOT NULL;
CREATE INDEX planilla_buseta_fecha ON planilla (buseta_id, fecha);
