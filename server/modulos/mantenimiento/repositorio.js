// ---- Tipos de mantenimiento e intervalos --------------------------------------
const SELECT_TIPO = `
  SELECT clave, nombre,
         intervalo_km    AS "intervaloKm",
         intervalo_meses AS "intervaloMeses",
         activo
    FROM tipo_mantenimiento
`;

export async function listarTipos(db) {
  const { rows } = await db.query(`${SELECT_TIPO} ORDER BY orden`);
  return rows;
}

export async function actualizarTipo(db, clave, { intervaloKm, intervaloMeses }) {
  const { rows } = await db.query(
    `UPDATE tipo_mantenimiento SET intervalo_km = $2, intervalo_meses = $3 WHERE clave = $1 RETURNING clave`,
    [clave, intervaloKm, intervaloMeses],
  );
  return rows.length > 0;
}

// ---- Registros de mantenimiento -----------------------------------------------
const SELECT_REGISTRO = `
  SELECT m.id,
         m.buseta_id      AS "busetaId",
         m.tipo,
         t.nombre         AS "tipoNombre",
         m.fecha,
         m.kilometraje,
         m.proximo_km     AS "proximoKm",
         m.proxima_fecha  AS "proximaFecha",
         m.observacion,
         json_build_object('id', u.id, 'nombre', u.nombre) AS "registradoPor",
         m.creado_en      AS "creadoEn"
    FROM mantenimiento m
    JOIN tipo_mantenimiento t ON t.clave = m.tipo
    JOIN usuario u            ON u.id = m.registrado_por
`;

export async function listarRegistros(db, busetaId) {
  const { rows } = await db.query(`${SELECT_REGISTRO} WHERE m.buseta_id = $1 ORDER BY m.fecha DESC, m.id DESC`, [
    busetaId,
  ]);
  return rows;
}

export async function obtenerRegistro(db, id) {
  const { rows } = await db.query(`${SELECT_REGISTRO} WHERE m.id = $1`, [id]);
  return rows[0] ?? null;
}

// Último registro de cada tipo, de una buseta o (busetaId null) de toda la flota.
export async function ultimosPorTipo(db, busetaId = null) {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (m.buseta_id, m.tipo)
            m.id, m.buseta_id AS "busetaId", m.tipo, m.fecha, m.kilometraje,
            m.proximo_km AS "proximoKm", m.proxima_fecha AS "proximaFecha"
       FROM mantenimiento m
      WHERE $1::bigint IS NULL OR m.buseta_id = $1
      ORDER BY m.buseta_id, m.tipo, m.fecha DESC, m.id DESC`,
    [busetaId],
  );
  return rows;
}

// Varios trabajos del mismo día en una sola sentencia (o se guardan todos o ninguno).
export async function crearRegistros(db, { busetaId, fecha, kilometraje, observacion, items, registradoPor }) {
  await db.query(
    `INSERT INTO mantenimiento (buseta_id, tipo, fecha, kilometraje, proximo_km, proxima_fecha, observacion, registrado_por)
     SELECT $1, i.tipo, $2, $3, i."proximoKm", i."proximaFecha", $4, $5
       FROM jsonb_to_recordset($6::jsonb) AS i(tipo TEXT, "proximoKm" INTEGER, "proximaFecha" DATE)`,
    [busetaId, fecha, kilometraje, observacion, registradoPor, JSON.stringify(items)],
  );
}

export async function actualizarRegistro(db, id, r) {
  await db.query(
    `UPDATE mantenimiento
        SET tipo = $2, fecha = $3, kilometraje = $4, proximo_km = $5, proxima_fecha = $6, observacion = $7
      WHERE id = $1`,
    [id, r.tipo, r.fecha, r.kilometraje, r.proximoKm, r.proximaFecha, r.observacion],
  );
}

export async function borrarRegistro(db, id) {
  await db.query('DELETE FROM mantenimiento WHERE id = $1', [id]);
}

// ---- Kilometraje ----------------------------------------------------------------
const SELECT_LECTURA = `
  SELECT l.id,
         l.buseta_id   AS "busetaId",
         l.fecha,
         l.kilometraje,
         json_build_object('id', u.id, 'nombre', u.nombre) AS "registradoPor",
         l.creado_en   AS "creadoEn"
    FROM lectura_kilometraje l
    JOIN usuario u ON u.id = l.registrado_por
`;

export async function listarLecturas(db, busetaId, limite = 10) {
  const { rows } = await db.query(`${SELECT_LECTURA} WHERE l.buseta_id = $1 ORDER BY l.fecha DESC LIMIT $2`, [
    busetaId,
    limite,
  ]);
  return rows;
}

export async function obtenerLectura(db, id) {
  const { rows } = await db.query(`${SELECT_LECTURA} WHERE l.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function lecturaDelDia(db, busetaId, fecha) {
  const { rows } = await db.query(`${SELECT_LECTURA} WHERE l.buseta_id = $1 AND l.fecha = $2`, [busetaId, fecha]);
  return rows[0] ?? null;
}

// Una lectura por día: reportar otra vez el mismo día la reemplaza.
export async function guardarLectura(db, { busetaId, fecha, kilometraje, registradoPor }) {
  await db.query(
    `INSERT INTO lectura_kilometraje (buseta_id, fecha, kilometraje, registrado_por)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (buseta_id, fecha) DO UPDATE
       SET kilometraje = EXCLUDED.kilometraje,
           registrado_por = EXCLUDED.registrado_por,
           creado_en = now()`,
    [busetaId, fecha, kilometraje, registradoPor],
  );
}

export async function borrarLectura(db, id) {
  await db.query('DELETE FROM lectura_kilometraje WHERE id = $1', [id]);
}

// Todo lo que dice el odómetro: lecturas y mantenimientos con kilometraje.
const KILOMETRAJES = `
  SELECT id AS lectura_id, NULL::bigint AS registro_id, buseta_id, fecha, kilometraje
    FROM lectura_kilometraje
  UNION ALL
  SELECT NULL, id, buseta_id, fecha, kilometraje
    FROM mantenimiento
   WHERE kilometraje IS NOT NULL
`;

// Kilometraje actual (el del reporte más reciente; el mismo día, el más alto) de
// una buseta o de toda la flota. No se valida que el odómetro vaya en orden: se
// puede corregir un dato mal puesto o un odómetro cambiado.
export async function kilometrajesActuales(db, busetaId = null) {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (buseta_id) buseta_id AS "busetaId", kilometraje AS actual, fecha
       FROM (${KILOMETRAJES}) k
      WHERE $1::bigint IS NULL OR buseta_id = $1
      ORDER BY buseta_id, fecha DESC, kilometraje DESC`,
    [busetaId],
  );
  return rows;
}

