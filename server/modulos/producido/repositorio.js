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

// Guarda el cierre del mes. `origen` 'calculado' (botón "Cerrar el mes": solo si
// el mes no estaba cerrado) o 'liquidacion' (la de la cooperativa: manda, así que
// reemplaza la anterior o un cierre calculado). Devuelve true si quedó guardado.
export async function guardarCierre(db, { busetaId, anio, mes, cierre, origen, liquidacion = null, cerradoPor }) {
  const { rowCount } = await db.query(
    `INSERT INTO cierre_mensual
       (buseta_id, anio, mes, bruto, reposicion, empresa, conductor, peajes, salidas, mantenimiento, arriendo,
        acpm, neto, polizas, prestamos, relevo, bono, origen, liquidacion, estado, cerrado_por, cerrado_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
             'cerrado', $20, now())
     ON CONFLICT (buseta_id, anio, mes) DO UPDATE
       SET bruto = EXCLUDED.bruto, reposicion = EXCLUDED.reposicion, empresa = EXCLUDED.empresa,
           conductor = EXCLUDED.conductor, peajes = EXCLUDED.peajes, salidas = EXCLUDED.salidas,
           mantenimiento = EXCLUDED.mantenimiento, arriendo = EXCLUDED.arriendo, acpm = EXCLUDED.acpm,
           neto = EXCLUDED.neto, polizas = EXCLUDED.polizas, prestamos = EXCLUDED.prestamos,
           relevo = EXCLUDED.relevo, bono = EXCLUDED.bono, origen = EXCLUDED.origen,
           liquidacion = EXCLUDED.liquidacion, estado = 'cerrado', cerrado_por = EXCLUDED.cerrado_por,
           cerrado_en = now()
       WHERE EXCLUDED.origen = 'liquidacion' OR cierre_mensual.estado <> 'cerrado'`,
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
      origen,
      liquidacion && JSON.stringify(liquidacion),
      cerradoPor,
    ],
  );
  return rowCount > 0;
}

// Reabre el mes: borra su cierre. Con `origen`, solo si el cierre es de ese origen.
export async function borrarCierre(db, busetaId, anio, mes, origen = null) {
  const { rowCount } = await db.query(
    `DELETE FROM cierre_mensual
      WHERE buseta_id = $1 AND anio = $2 AND mes = $3 AND ($4::text IS NULL OR origen = $4)`,
    [busetaId, anio, mes, origen],
  );
  return rowCount > 0;
}

// Busetas activas con producido en el mes y sin cerrar (ni con la planilla ni
// con la liquidación de la cooperativa): para recordarle al admin que las cierre.
export async function pendientesDeCierre(db, anio, mes) {
  const { desde, hasta } = rangoDelMes(anio, mes);
  const { rows } = await db.query(
    `SELECT b.id AS "busetaId", b.numero_interno AS "numeroInterno"
       FROM buseta b
      WHERE b.activo
        AND EXISTS (SELECT 1 FROM producido_diario p
                     WHERE p.buseta_id = b.id AND p.fecha BETWEEN $1 AND $2 AND p.ingreso > 0)
        AND NOT EXISTS (SELECT 1 FROM cierre_mensual c
                         WHERE c.buseta_id = b.id AND c.anio = $3 AND c.mes = $4 AND c.estado = 'cerrado')
      ORDER BY b.numero_interno`,
    [desde, hasta, anio, mes],
  );
  return rows;
}

// ---- Planillas de despacho ----------------------------------------------------

const CAMPOS_PLANILLA = `
  p.id, p.fecha, p.ruta_id AS "rutaId", r.nombre AS ruta, p.sentido, p.consecutivo, p.valor, p.peaje, p.salida,
  p.creado_en AS "creadoEn"
`;

export async function listarPlanillas(db, busetaId, desde, hasta) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS_PLANILLA}
       FROM planilla p LEFT JOIN ruta r ON r.id = p.ruta_id
      WHERE p.buseta_id = $1 AND p.fecha BETWEEN $2 AND $3
      ORDER BY p.fecha, p.creado_en, p.id`,
    [busetaId, desde, hasta],
  );
  return rows;
}

export async function obtenerPlanilla(db, id) {
  const { rows } = await db.query(
    'SELECT id, buseta_id AS "busetaId", fecha FROM planilla WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}

// La planilla con ese consecutivo en la buseta (para no digitarla dos veces).
export async function planillaPorConsecutivo(db, busetaId, consecutivo) {
  const { rows } = await db.query(
    'SELECT id, fecha FROM planilla WHERE buseta_id = $1 AND consecutivo = $2',
    [busetaId, consecutivo],
  );
  return rows[0] ?? null;
}

export async function crearPlanilla(db, p) {
  const { rows } = await db.query(
    `INSERT INTO planilla (buseta_id, fecha, ruta_id, sentido, consecutivo, valor, peaje, salida, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [p.busetaId, p.fecha, p.rutaId ?? null, p.sentido, p.consecutivo, p.valor, p.peaje, p.salida, p.creadoPor],
  );
  return rows[0].id;
}

export async function borrarPlanilla(db, id) {
  await db.query('DELETE FROM planilla WHERE id = $1', [id]);
}

// Suma de las planillas de un día: producido (valor), peajes, salidas y cuántas son.
export async function sumaPlanillasDelDia(db, busetaId, fecha) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(valor), 0)::bigint AS ingreso, COALESCE(SUM(peaje), 0)::bigint AS peajes,
            COALESCE(SUM(salida), 0)::bigint AS salidas, COUNT(*)::int AS cuantas
       FROM planilla WHERE buseta_id = $1 AND fecha = $2`,
    [busetaId, fecha],
  );
  const r = rows[0];
  return { ingreso: Number(r.ingreso), peajes: Number(r.peajes), salidas: Number(r.salidas), cuantas: r.cuantas };
}
