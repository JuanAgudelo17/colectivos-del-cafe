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

// Días con peajes (> 0) de una buseta en un rango, en orden. Salen de la columna
// peajes del producido.
export async function diasConPeajes(db, busetaId, desde, hasta) {
  const { rows } = await db.query(
    `SELECT fecha, peajes FROM producido_diario
      WHERE buseta_id = $1 AND fecha BETWEEN $2 AND $3 AND peajes > 0
      ORDER BY fecha`,
    [busetaId, desde, hasta],
  );
  return rows;
}

// Entregas de plata al propietario, en el orden en que cubren los peajes.
export async function listarEntregas(db, busetaId) {
  const { rows } = await db.query(
    `SELECT l.id, l.fecha, l.valor, l.observacion, l.creado_en AS "creadoEn",
            l.registrado_por AS "registradoPor", u.rol AS "registradoPorRol"
       FROM liquidacion_peaje l
       JOIN usuario u ON u.id = l.registrado_por
      WHERE l.buseta_id = $1
      ORDER BY l.fecha, l.id`,
    [busetaId],
  );
  return rows;
}

export async function crearEntrega(db, e) {
  await db.query(
    `INSERT INTO liquidacion_peaje (buseta_id, conductor_id, fecha, valor, observacion, registrado_por)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [e.busetaId, e.conductorId, e.fecha, e.valor, e.observacion, e.registradoPor],
  );
}

export async function obtenerEntrega(db, id) {
  const { rows } = await db.query(
    `SELECT id, buseta_id AS "busetaId", registrado_por AS "registradoPor", creado_en AS "creadoEn"
       FROM liquidacion_peaje WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function borrarEntrega(db, id) {
  await db.query('DELETE FROM liquidacion_peaje WHERE id = $1', [id]);
}
