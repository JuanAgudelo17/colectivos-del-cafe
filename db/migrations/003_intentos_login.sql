-- 003_intentos_login.sql
-- Registro de intentos fallidos de login para frenar ataques de fuerza bruta.
-- Se guarda en la BD (no en memoria) porque cada función serverless es efímera.

CREATE TABLE intento_login (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario    TEXT        NOT NULL,
  ip         TEXT,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX intento_login_usuario_idx ON intento_login (lower(usuario), creado_en);
CREATE INDEX intento_login_ip_idx ON intento_login (ip, creado_en);

ALTER TABLE intento_login ENABLE ROW LEVEL SECURITY;
