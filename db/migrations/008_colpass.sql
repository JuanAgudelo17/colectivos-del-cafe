-- 008_colpass.sql
-- Peajes con Colpass (tag electrónico). En el producido la empresa le reconoce al
-- conductor la plata de los peajes (columna `peajes`), pero el Colpass los cobra
-- aparte: el conductor guarda esa plata hasta que se la entrega al admin, que
-- registra la liquidación.

-- Busetas con Colpass y desde cuándo (antes de esa fecha los peajes se pagaban
-- en efectivo y no hay nada que liquidar).
CREATE TABLE colpass (
  buseta_id  BIGINT      PRIMARY KEY REFERENCES buseta (id),
  desde      DATE        NOT NULL,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cada liquidación cubre un rango de días de una buseta (los rangos no se cruzan;
-- lo valida el backend). `valor` es la suma de peajes del producido de esos días
-- al momento de liquidar.
CREATE TABLE liquidacion_peaje (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  buseta_id       BIGINT      NOT NULL REFERENCES buseta (id),
  conductor_id    BIGINT      REFERENCES usuario (id),
  desde           DATE        NOT NULL,
  hasta           DATE        NOT NULL,
  valor           BIGINT      NOT NULL CHECK (valor >= 0),
  observacion     TEXT,
  registrado_por  BIGINT      NOT NULL REFERENCES usuario (id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (desde <= hasta)
);

CREATE INDEX liquidacion_peaje_buseta_desde_idx ON liquidacion_peaje (buseta_id, desde);

ALTER TABLE colpass           ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidacion_peaje ENABLE ROW LEVEL SECURITY;
