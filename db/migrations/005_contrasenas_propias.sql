-- 005_contrasenas_propias.sql
-- Cada usuario crea su propia contraseña y puede pedir recuperarla.

ALTER TABLE usuario
  -- Contraseña generada por el sistema: al entrar debe crear la suya.
  ADD COLUMN debe_cambiar_password  BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Hasta cuándo sirve la contraseña temporal (NULL = no vence).
  ADD COLUMN password_temporal_hasta TIMESTAMPTZ,
  -- Se incrementa al cambiar la contraseña: invalida las sesiones abiertas.
  ADD COLUMN sesion_version         INTEGER     NOT NULL DEFAULT 0;

-- Todas las contraseñas actuales las generó el sistema: cada usuario crea la
-- suya en su próximo ingreso (sin vencimiento, para no dejar a nadie por fuera).
UPDATE usuario SET debe_cambiar_password = TRUE;

-- "Olvidé mi contraseña": el conductor deja una solicitud que atiende el admin.
CREATE TABLE solicitud_recuperacion (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id   BIGINT      NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
  ip           TEXT,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  atendida_en  TIMESTAMPTZ,
  atendida_por BIGINT      REFERENCES usuario (id)
);

-- A lo sumo una solicitud pendiente por usuario.
CREATE UNIQUE INDEX solicitud_recuperacion_pendiente_unica
  ON solicitud_recuperacion (usuario_id) WHERE atendida_en IS NULL;
CREATE INDEX solicitud_recuperacion_ip_idx ON solicitud_recuperacion (ip, creado_en);

ALTER TABLE solicitud_recuperacion ENABLE ROW LEVEL SECURITY;
