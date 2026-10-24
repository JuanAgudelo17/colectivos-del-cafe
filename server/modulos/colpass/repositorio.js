// Consultas del módulo colpass. Fechas como 'YYYY-MM-DD'.

export async function obtenerColpass(db, busetaId) {
  const { rows } = await db.query('SELECT desde FROM colpass WHERE buseta_id = $1', [busetaId]);
  return rows[0] ?? null;
}

export async function listarColpass(db) {
  const { rows } = await db.query('SELECT buseta_id AS "busetaId", desde FROM colpass');
  return rows;
}

export async function activarColpass(db, busetaId, desde) {
  await db.query(
    `INSERT INTO colpass (buseta_id, desde) VALUES ($1, $2)
     ON CONFLICT (buseta_id) DO UPDATE SET desde = EXCLUDED.desde`,
    [busetaId, desde],
  );
}

export async function quitarColpass(db, busetaId) {
  await db.query('DELETE FROM colpass WHERE buseta_id = $1', [busetaId]);
}

// Días con peajes en un rango, marcando los que ya quedaron en una liquidación.
// conductorId: solo los días de ese conductor (vista del conductor).
export async function diasConPeajes(db, { busetaId, desde, hasta, conductorId = null }) {
  const { rows } = await db.query(
    `SELECT p.fecha, p.peajes, l.id IS NOT NULL AS liquidado
       FROM producido_diario p
       LEFT JOIN liquidacion_peaje l
              ON l.buseta_id = p.buseta_id AND p.fecha BETWEEN l.desde AND l.hasta
      WHERE p.buseta_id = $1 AND p.fecha BETWEEN $2 AND $3 AND p.peajes > 0
        AND ($4::bigint IS NULL OR p.conductor_id = $4)
      ORDER BY p.fecha`,
    [busetaId, desde, hasta, conductorId],
  );
  return rows;
}

// Lo que el conductor tiene guardado: peajes desde que hay Colpass que no están
// en ninguna liquidación.
export async function pendiente(db, { busetaId, desde, hasta, conductorId = null }) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(p.peajes), 0)::bigint AS total, COUNT(*)::int AS dias,
            MIN(p.fecha) AS desde, MAX(p.fecha) AS hasta
       FROM producido_diario p
      WHERE p.buseta_id = $1 AND p.fecha BETWEEN $2 AND $3 AND p.peajes > 0
        AND ($4::bigint IS NULL OR p.conductor_id = $4)
        AND NOT EXISTS (
              SELECT 1 FROM liquidacion_peaje l
               WHERE l.buseta_id = p.buseta_id AND p.fecha BETWEEN l.desde AND l.hasta)`,
    [busetaId, desde, hasta, conductorId],
  );
  return rows[0];
}

export async function sumaPeajes(db, busetaId, desde, hasta) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(peajes), 0)::bigint AS total
       FROM producido_diario WHERE buseta_id = $1 AND fecha BETWEEN $2 AND $3`,
    [busetaId, desde, hasta],
  );
  return rows[0].total;
}

// `valorActual`: lo que suman hoy esos días (si el producido se corrigió después
// de liquidar, no coincide con `valor`).
export async function listarLiquidaciones(db, busetaId, conductorId = null) {
  const { rows } = await db.query(
    `SELECT l.id, l.desde, l.hasta, l.valor, l.observacion, l.creado_en AS "creadoEn",
            (SELECT COALESCE(SUM(p.peajes), 0)::bigint FROM producido_diario p
              WHERE p.buseta_id = l.buseta_id AND p.fecha BETWEEN l.desde AND l.hasta) AS "valorActual"
       FROM liquidacion_peaje l
      WHERE l.buseta_id = $1 AND ($2::bigint IS NULL OR l.conductor_id = $2)
      ORDER BY l.desde DESC`,
    [busetaId, conductorId],
  );
  return rows;
}

export async function liquidacionQueSeCruza(db, busetaId, desde, hasta) {
  const { rows } = await db.query(
    `SELECT desde, hasta FROM liquidacion_peaje
      WHERE buseta_id = $1 AND desde <= $3 AND hasta >= $2
      ORDER BY desde LIMIT 1`,
    [busetaId, desde, hasta],
  );
  return rows[0] ?? null;
}

export async function crearLiquidacion(db, l) {
  await db.query(
    `INSERT INTO liquidacion_peaje (buseta_id, conductor_id, desde, hasta, valor, observacion, registrado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [l.busetaId, l.conductorId, l.desde, l.hasta, l.valor, l.observacion, l.registradoPor],
  );
}

export async function obtenerLiquidacion(db, id) {
  const { rows } = await db.query('SELECT id, buseta_id AS "busetaId" FROM liquidacion_peaje WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function borrarLiquidacion(db, id) {
  await db.query('DELETE FROM liquidacion_peaje WHERE id = $1', [id]);
}
