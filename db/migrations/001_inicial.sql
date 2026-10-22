-- 001_inicial.sql
-- Esquema base: empresas, usuarios, busetas, documentos, producido, facturas,
-- parámetros y cierres mensuales. Dinero en pesos enteros (BIGINT), nunca float.

-- ---------------------------------------------------------------------------
-- empresa
-- ---------------------------------------------------------------------------
CREATE TABLE empresa (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     TEXT        NOT NULL,
  nit        TEXT        UNIQUE,
  activo     BOOLEAN     NOT NULL DEFAULT TRUE,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- buseta
-- ---------------------------------------------------------------------------
CREATE TABLE buseta (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id      BIGINT      NOT NULL REFERENCES empresa (id),
  numero_interno  TEXT        NOT NULL,
  placa           TEXT        NOT NULL UNIQUE CHECK (placa = upper(placa)),
  modelo          TEXT,
  tiene_cupo      BOOLEAN     NOT NULL DEFAULT TRUE,
  valor_arriendo  BIGINT      CHECK (valor_arriendo >= 0),
  activo          BOOLEAN     NOT NULL DEFAULT TRUE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (empresa_id, numero_interno),
  -- Permite que usuario referencie (buseta_id, empresa_id) y garantice que
  -- un conductor solo tenga asignada una buseta de su propia empresa.
  UNIQUE (id, empresa_id),
  -- Sin cupo → debe pagar arriendo.
  CHECK (tiene_cupo OR valor_arriendo IS NOT NULL)
);

CREATE INDEX buseta_empresa_idx ON buseta (empresa_id);

-- ---------------------------------------------------------------------------
-- usuario (admin global o conductor de una empresa)
-- ---------------------------------------------------------------------------
CREATE TABLE usuario (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id     BIGINT      REFERENCES empresa (id),
  usuario        TEXT        NOT NULL,
  nombre         TEXT        NOT NULL,
  cedula         TEXT,
  telefono       TEXT,
  password_hash  TEXT        NOT NULL,
  rol            TEXT        NOT NULL CHECK (rol IN ('admin', 'conductor')),
  buseta_id      BIGINT      UNIQUE,  -- 1 a 1: una buseta tiene a lo sumo un conductor
  activo         BOOLEAN     NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),

  FOREIGN KEY (buseta_id, empresa_id) REFERENCES buseta (id, empresa_id),
  -- Todo conductor pertenece a una empresa; el admin global no.
  CHECK (rol = 'admin' OR empresa_id IS NOT NULL),
  -- Solo los conductores tienen buseta.
  CHECK (rol = 'conductor' OR buseta_id IS NULL)
);

-- Login sin distinguir mayúsculas: "Juan" y "juan" son el mismo usuario.
CREATE UNIQUE INDEX usuario_usuario_unico ON usuario (lower(usuario));
CREATE INDEX usuario_empresa_idx ON usuario (empresa_id);

-- ---------------------------------------------------------------------------
-- documento_buseta (SOAT y tecnomecánica, uno por buseta)
-- ---------------------------------------------------------------------------
CREATE TABLE documento_buseta (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  buseta_id            BIGINT NOT NULL UNIQUE REFERENCES buseta (id) ON DELETE CASCADE,
  fecha_soat           DATE,
  fecha_tecnomecanica  DATE
);

-- ---------------------------------------------------------------------------
-- producido_diario (un registro por buseta y día)
-- ---------------------------------------------------------------------------
CREATE TABLE producido_diario (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  buseta_id      BIGINT      NOT NULL REFERENCES buseta (id),
  conductor_id   BIGINT      NOT NULL REFERENCES usuario (id),
  fecha          DATE        NOT NULL,
  ingreso        BIGINT      NOT NULL DEFAULT 0 CHECK (ingreso >= 0),
  peajes         BIGINT      NOT NULL DEFAULT 0 CHECK (peajes >= 0),
  salidas        BIGINT      NOT NULL DEFAULT 0 CHECK (salidas >= 0),
  acpm           BIGINT      NOT NULL DEFAULT 0 CHECK (acpm >= 0),
  mantenimiento  BIGINT      NOT NULL DEFAULT 0 CHECK (mantenimiento >= 0),
  otros          BIGINT      NOT NULL DEFAULT 0 CHECK (otros >= 0),
  observacion    TEXT,
  creado_por     BIGINT      NOT NULL REFERENCES usuario (id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (buseta_id, fecha)
);

CREATE INDEX producido_conductor_fecha_idx ON producido_diario (conductor_id, fecha);

-- ---------------------------------------------------------------------------
-- factura (gasto registrado por el conductor, foto opcional)
-- ---------------------------------------------------------------------------
CREATE TABLE factura (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conductor_id  BIGINT      NOT NULL REFERENCES usuario (id),
  buseta_id     BIGINT      NOT NULL REFERENCES buseta (id),
  fecha         DATE        NOT NULL,
  categoria     TEXT        NOT NULL DEFAULT 'otro'
                CHECK (categoria IN ('peaje', 'mantenimiento', 'acpm', 'salida', 'otro')),
  descripcion   TEXT        NOT NULL CHECK (length(trim(descripcion)) > 0),
  precio        BIGINT      NOT NULL CHECK (precio > 0),
  imagen_path   TEXT,       -- ruta dentro del bucket privado "facturas"
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX factura_buseta_fecha_idx ON factura (buseta_id, fecha);
CREATE INDEX factura_conductor_fecha_idx ON factura (conductor_id, fecha);

-- ---------------------------------------------------------------------------
-- parametro (valores del cálculo con vigencia; empresa_id NULL = global)
-- ---------------------------------------------------------------------------
CREATE TABLE parametro (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id     BIGINT        REFERENCES empresa (id),
  clave          TEXT          NOT NULL
                 CHECK (clave IN ('porcentaje_empresa', 'porcentaje_reposicion', 'sueldo_conductor')),
  valor          NUMERIC(14,4) NOT NULL CHECK (valor >= 0),
  vigente_desde  DATE          NOT NULL,

  UNIQUE NULLS NOT DISTINCT (empresa_id, clave, vigente_desde)
);

-- ---------------------------------------------------------------------------
-- cierre_mensual (consolidado inmutable una vez cerrado)
-- ---------------------------------------------------------------------------
CREATE TABLE cierre_mensual (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  buseta_id      BIGINT      NOT NULL REFERENCES buseta (id),
  anio           SMALLINT    NOT NULL CHECK (anio BETWEEN 2020 AND 2100),
  mes            SMALLINT    NOT NULL CHECK (mes BETWEEN 1 AND 12),
  bruto          BIGINT      NOT NULL,
  reposicion     BIGINT      NOT NULL,
  empresa        BIGINT      NOT NULL,
  conductor      BIGINT      NOT NULL,
  peajes         BIGINT      NOT NULL,
  salidas        BIGINT      NOT NULL,
  mantenimiento  BIGINT      NOT NULL,
  arriendo       BIGINT      NOT NULL,
  acpm           BIGINT      NOT NULL,
  neto           BIGINT      NOT NULL,  -- puede ser negativo (mes con pérdida)
  estado         TEXT        NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  cerrado_por    BIGINT      REFERENCES usuario (id),
  cerrado_en     TIMESTAMPTZ,

  UNIQUE (buseta_id, anio, mes),
  CHECK (estado = 'abierto' OR (cerrado_por IS NOT NULL AND cerrado_en IS NOT NULL))
);

-- ---------------------------------------------------------------------------
-- Seguridad: Supabase expone el esquema public por su API REST con la llave
-- "anon". Activar RLS sin políticas bloquea ese acceso; nuestro backend se
-- conecta como dueño de las tablas y no se ve afectado.
-- ---------------------------------------------------------------------------
ALTER TABLE empresa          ENABLE ROW LEVEL SECURITY;
ALTER TABLE buseta           ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario          ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_buseta ENABLE ROW LEVEL SECURITY;
ALTER TABLE producido_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE factura          ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametro        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cierre_mensual   ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Datos semilla. El admin NO se crea aquí (su contraseña no puede ir en git):
-- se crea con `npm run crear-admin`.
-- ---------------------------------------------------------------------------
INSERT INTO empresa (nombre) VALUES ('Colectivos del Café');

INSERT INTO parametro (empresa_id, clave, valor, vigente_desde) VALUES
  (NULL, 'porcentaje_empresa',    0.20,    '2026-01-01'),
  (NULL, 'porcentaje_reposicion', 0.01,    '2026-01-01'),
  (NULL, 'sueldo_conductor',      3066000, '2026-01-01');
