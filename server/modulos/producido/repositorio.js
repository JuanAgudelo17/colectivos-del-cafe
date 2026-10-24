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
  fecha, ingreso, peajes, salidas, acpm, acpm_credito AS "acpmCredito", mantenimiento, relevo, observacion,
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
       (buseta_id, fecha, conductor_id, ingreso, peajes, salidas, acpm, mantenimiento, relevo, observacion, creado_por,
        acpm_credito)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (buseta_id, fecha) DO UPDATE
       SET ingreso = EXCLUDED.ingreso,
           peajes = EXCLUDED.peajes,
           salidas = EXCLUDED.salidas,
           acpm = EXCLUDED.acpm,
           acpm_credito = EXCLUDED.acpm_credito,
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
      d.acpmCredito,
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

// ---- Todo un año, de todas las busetas (para el módulo rentabilidad) --------

// Días, ajustes y cierres del año, agrupables por buseta y mes.
export async function datosDelAnio(db, anio) {
  const [dias, ajustes, cierres] = await Promise.all([
    db.query(
      `SELECT buseta_id AS "busetaId", EXTRACT(MONTH FROM fecha)::int AS mes,
              ingreso, peajes, salidas, acpm, acpm_credito AS "acpmCredito", mantenimiento, relevo
         FROM producido_diario
        WHERE fecha BETWEEN $1 AND $2`,
      [`${anio}-01-01`, `${anio}-12-31`],
    ),
    db.query('SELECT buseta_id AS "busetaId", mes, tipo, valor FROM ajuste_mensual WHERE anio = $1', [anio]),
    db.query(`SELECT ${CAMPOS_CIERRE} FROM cierre_mensual WHERE anio = $1 AND estado = 'cerrado'`, [anio]),
  ]);
  return { dias: dias.rows, ajustes: ajustes.rows, cierres: cierres.rows };
}

// Producido y días trabajados de cada buseta en un rango (las que no trabajaron no salen).
export async function producidoPorBuseta(db, desde, hasta) {
  const { rows } = await db.query(
    `SELECT buseta_id AS "busetaId", SUM(ingreso)::bigint AS bruto,
            COUNT(*) FILTER (WHERE ingreso > 0)::int AS "diasTrabajados"
       FROM producido_diario
      WHERE fecha BETWEEN $1 AND $2
      GROUP BY buseta_id`,
    [desde, hasta],
  );
  return rows;
}

// Primer año con producido registrado (null si todavía no hay nada).
export async function primerAnio(db) {
  const { rows } = await db.query('SELECT EXTRACT(YEAR FROM min(fecha))::int AS anio FROM producido_diario');
  return rows[0]?.anio ?? null;
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

// ---- Cierres del mes (por ahora, con la liquidación de la cooperativa) ---------

const CAMPOS_CIERRE = `
  buseta_id AS "busetaId", anio, mes, bruto, reposicion, empresa, conductor, peajes, salidas,
  mantenimiento, arriendo, acpm, neto, polizas, prestamos, relevo, bono, origen, liquidacion,
  cerrado_en AS "cerradoEn"
`;

export async function obtenerCierre(db, busetaId, anio, mes) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS_CIERRE} FROM cierre_mensual
      WHERE buseta_id = $1 AND anio = $2 AND mes = $3 AND estado = 'cerrado'`,
    [busetaId, anio, mes],
  );
  return rows[0] ?? null;
}

export async function cierresDelMes(db, anio, mes) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS_CIERRE} FROM cierre_mensual WHERE anio = $1 AND mes = $2 AND estado = 'cerrado'`,
    [anio, mes],
  );
  return rows;
}

// Cierra el mes con la liquidación (o la reemplaza si ya estaba). Nunca pisa un
// cierre calculado por la app.
export async function guardarCierreLiquidacion(db, { busetaId, anio, mes, cierre, liquidacion, cerradoPor }) {
  await db.query(
    `INSERT INTO cierre_mensual
       (buseta_id, anio, mes, bruto, reposicion, empresa, conductor, peajes, salidas, mantenimiento, arriendo,
        acpm, neto, polizas, prestamos, relevo, bono, origen, liquidacion, estado, cerrado_por, cerrado_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'liquidacion', $18,
             'cerrado', $19, now())
     ON CONFLICT (buseta_id, anio, mes) DO UPDATE
       SET bruto = EXCLUDED.bruto, reposicion = EXCLUDED.reposicion, empresa = EXCLUDED.empresa,
           conductor = EXCLUDED.conductor, peajes = EXCLUDED.peajes, salidas = EXCLUDED.salidas,
           mantenimiento = EXCLUDED.mantenimiento, arriendo = EXCLUDED.arriendo, acpm = EXCLUDED.acpm,
           neto = EXCLUDED.neto, polizas = EXCLUDED.polizas, prestamos = EXCLUDED.prestamos,
           relevo = EXCLUDED.relevo, bono = EXCLUDED.bono, liquidacion = EXCLUDED.liquidacion,
           estado = 'cerrado', cerrado_por = EXCLUDED.cerrado_por, cerrado_en = now()
       WHERE cierre_mensual.origen = 'liquidacion'`,
    [
      busetaId,
      anio,
      mes,
      cierre.bruto,
      cierre.reposicion,
      cierre.empresa,
      cierre.conductor,
      cierre.peajes,
      cierre.salidas,
      cierre.mantenimiento,
      cierre.arriendo,
      cierre.acpm,
      cierre.neto,
      cierre.polizas,
      cierre.prestamos,
      cierre.relevo,
      cierre.bono,
      JSON.stringify(liquidacion),
      cerradoPor,
    ],
  );
}

// Reabre el mes quitando la liquidación (solo si el cierre vino de una).
export async function borrarCierreLiquidacion(db, busetaId, anio, mes) {
  const { rowCount } = await db.query(
    `DELETE FROM cierre_mensual WHERE buseta_id = $1 AND anio = $2 AND mes = $3 AND origen = 'liquidacion'`,
    [busetaId, anio, mes],
  );
  return rowCount > 0;
}
