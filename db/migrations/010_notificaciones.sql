-- 010_notificaciones.sql
-- Recordatorios: avisos dentro de la app (la campanita) y notificaciones push al
-- celular. Una revisión diaria los genera (documentos por vencer, mantenimientos,
-- kilometraje sin reportar, peajes Colpass por entregar).

-- Celulares o navegadores donde cada usuario aceptó recibir notificaciones push.
-- `endpoint` es la dirección que da el servicio de push del navegador (único).
CREATE TABLE suscripcion_push (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  BIGINT      NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL UNIQUE,
  p256dh      TEXT        NOT NULL,
  auth        TEXT        NOT NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX suscripcion_push_usuario_idx ON suscripcion_push (usuario_id);

-- Avisos de cada usuario. `clave` identifica el aviso (ej. el SOAT de la 2033 que
-- vence en 7 días): no se repite el mismo aviso aunque la revisión corra otra vez.
CREATE TABLE notificacion (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  BIGINT      NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
  clave       TEXT        NOT NULL,
  tipo        TEXT        NOT NULL CHECK (tipo IN ('documento', 'mantenimiento', 'kilometraje', 'colpass')),
  titulo      TEXT        NOT NULL,
  cuerpo      TEXT        NOT NULL,
  url         TEXT        NOT NULL,
  creada_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  leida_en    TIMESTAMPTZ,

  UNIQUE (usuario_id, clave)
);

CREATE INDEX notificacion_usuario_fecha_idx ON notificacion (usuario_id, creada_en DESC);

ALTER TABLE suscripcion_push ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacion     ENABLE ROW LEVEL SECURITY;
