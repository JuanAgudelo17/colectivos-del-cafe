// Consultas del módulo producido. Fechas como 'YYYY-MM-DD' (texto, sin zona horaria).

export function rangoDelMes(anio, mes) {
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, '0');
  return { desde: `${anio}-${mm}-01`, hasta: `${anio}-${mm}-${String(ultimoDia).padStart(2, '0')}`, ultimoDia };
}

// Parámetros vigentes al final del mes (el más reciente de cada clave).
export async function parametrosDelMes(db, hasta) {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (clave) clave, valor::text AS valor
       FROM parametro
      WHERE vigente_desde <= $1
      ORDER BY clave, vigente_desde DESC`,
    [hasta],
  );
  return Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
}

const CAMPOS_DIA = `
  fecha, ingreso, peajes, salidas, acpm, mantenimiento, relevo, observacion,
  conductor_id AS "conductorId"
`;

export async function listarDias(db, busetaId, desde, hasta, conductorId = null) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS_DIA}
       FROM producido_diario
      WHERE buseta_id = $1 AND fecha BETWEEN $2 AND $3
        AND ($4::bigint IS NULL OR conductor_id = $4)
      ORDER BY fecha`,
    [busetaId, desde, hasta, conductorId],
  );
  return rows;
}

// Crea o reemplaza el registro de un día (único por buseta y fecha).
export async function guardarDia(db, { busetaId, fecha, conductorId, creadoPor }, d) {
  const { rows } = await db.query(
    `INSERT INTO producido_diario
       (buseta_id, fecha, conductor_id, ingreso, peajes, salidas, acpm, mantenimiento, relevo, observacion, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (buseta_id, fecha) DO UPDATE
       SET ingreso = EXCLUDED.ingreso,
           peajes = EXCLUDED.peajes,
           salidas = EXCLUDED.salidas,
           acpm = EXCLUDED.acpm,
           mantenimiento = EXCLUDED.mantenimiento,
           relevo = EXCLUDED.relevo,
           observacion = EXCLUDED.observacion
     RETURNING ${CAMPOS_DIA}`,
    [
      busetaId,
      fecha,
      conductorId,
      d.ingreso,
      d.peajes,
      d.salidas,
      d.acpm,
      d.mantenimiento,
      d.relevo,
      d.observacion,
      creadoPor,
    ],
  );
  return rows[0];
}

export async function borrarDia(db, busetaId, fecha) {
  await db.query('DELETE FROM producido_diario WHERE buseta_id = $1 AND fecha = $2', [busetaId, fecha]);
}

export async function mesCerrado(db, busetaId, anio, mes) {
  const { rows } = await db.query(
    `SELECT 1 FROM cierre_mensual WHERE buseta_id = $1 AND anio = $2 AND mes = $3 AND estado = 'cerrado'`,
    [busetaId, anio, mes],
  );
  return rows.length > 0;
}

// ---- Ajustes del mes (bono, préstamos) --------------------------------------

export async function listarAjustes(db, busetaId, anio, mes) {
  const { rows } = await db.query(
    `SELECT id, tipo, descripcion, valor, creado_en AS "creadoEn"
       FROM ajuste_mensual
      WHERE buseta_id = $1 AND anio = $2 AND mes = $3
      ORDER BY creado_en`,
    [busetaId, anio, mes],
  );
  return rows;
}

export async function crearAjuste(db, a) {
  await db.query(
    `INSERT INTO ajuste_mensual (buseta_id, anio, mes, tipo, descripcion, valor, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [a.busetaId, a.anio, a.mes, a.tipo, a.descripcion, a.valor, a.creadoPor],
  );
}

export async function obtenerAjuste(db, id) {
  const { rows } = await db.query(
    'SELECT id, buseta_id AS "busetaId", anio, mes FROM ajuste_mensual WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}

export async function borrarAjuste(db, id) {
  await db.query('DELETE FROM ajuste_mensual WHERE id = $1', [id]);
}

// ---- Rutas y tarifas ----------------------------------------------------------

const CAMPOS_RUTA = `
  id, nombre,
  peaje_trayecto AS "peajeTrayecto",
  salida_ida     AS "salidaIda",
  salida_regreso AS "salidaRegreso",
  activo
`;

export async function listarRutas(db) {
  const { rows } = await db.query(`SELECT ${CAMPOS_RUTA} FROM ruta ORDER BY nombre`);
  return rows;
}

export async function actualizarRuta(db, id, r) {
  const { rows } = await db.query(
    `UPDATE ruta SET peaje_trayecto = $2, salida_ida = $3, salida_regreso = $4
      WHERE id = $1 RETURNING ${CAMPOS_RUTA}`,
    [id, r.peajeTrayecto, r.salidaIda, r.salidaRegreso],
  );
  return rows[0] ?? null;
}
