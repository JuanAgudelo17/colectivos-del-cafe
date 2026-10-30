-- 014_registro_errores.sql
-- Errores de la app en producción: los del servidor (500), los del navegador
-- (pantallas que se rompen, errores de JavaScript) y los de la revisión diaria.
-- El mismo error (misma huella) no se repite: se cuenta en `veces`. Al admin le
-- llega un aviso (campanita y push) a lo sumo una vez al día por cada uno.

CREATE TABLE error_app (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  huella       TEXT        NOT NULL UNIQUE,
  origen       TEXT        NOT NULL CHECK (origen IN ('servidor', 'navegador', 'programada')),
  mensaje      TEXT        NOT NULL,
  detalle      TEXT,
  ruta         TEXT,
  usuario_id   BIGINT      REFERENCES usuario (id) ON DELETE SET NULL,
  navegador    TEXT,
  veces        INTEGER     NOT NULL DEFAULT 1,
  primera_vez  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultima_vez   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resuelto_en  TIMESTAMPTZ
);

CREATE INDEX error_app_ultima_vez_idx ON error_app (ultima_vez DESC);

ALTER TABLE error_app ENABLE ROW LEVEL SECURITY;

-- Nuevo tipo de aviso para los admin.
ALTER TABLE notificacion DROP CONSTRAINT notificacion_tipo_check;
ALTER TABLE notificacion
  ADD CONSTRAINT notificacion_tipo_check
  CHECK (tipo IN ('documento', 'mantenimiento', 'kilometraje', 'colpass', 'producido', 'error'));
