// Consultas del módulo notificaciones.

const CAMPOS = `
  id, tipo, titulo, cuerpo, url,
  creada_en AS "creadaEn",
  leida_en  AS "leidaEn"
`;

// Usuarios activos que pueden recibir avisos (el conductor, con su buseta).
export async function usuariosActivos(db) {
  const { rows } = await db.query(
    `SELECT id, rol, buseta_id AS "busetaId" FROM usuario WHERE activo`,
  );
  return rows;
}

// Guarda los avisos y devuelve solo los nuevos (los repetidos por clave se ignoran).
export async function guardarNotificaciones(db, avisos) {
  const nuevas = [];
  for (const a of avisos) {
    const { rows } = await db.query(
      `INSERT INTO notificacion (usuario_id, clave, tipo, titulo, cuerpo, url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (usuario_id, clave) DO NOTHING
       RETURNING id, usuario_id AS "usuarioId", clave, tipo, titulo, cuerpo, url`,
      [a.usuarioId, a.clave, a.tipo, a.titulo, a.cuerpo, a.url],
    );
    if (rows[0]) nuevas.push(rows[0]);
  }
  return nuevas;
}

export async function listarNotificaciones(db, usuarioId, limite = 30) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS} FROM notificacion WHERE usuario_id = $1 ORDER BY creada_en DESC, id DESC LIMIT $2`,
    [usuarioId, limite],
  );
  return rows;
}

export async function contarNoLeidas(db, usuarioId) {
  const { rows } = await db.query(
    'SELECT count(*)::int AS n FROM notificacion WHERE usuario_id = $1 AND leida_en IS NULL',
    [usuarioId],
  );
  return rows[0].n;
}

// Marca como leídas las indicadas (o todas si no se indica ninguna). Solo las del usuario.
export async function marcarLeidas(db, usuarioId, ids = null) {
  await db.query(
    `UPDATE notificacion SET leida_en = now()
      WHERE usuario_id = $1 AND leida_en IS NULL AND ($2::bigint[] IS NULL OR id = ANY($2))`,
    [usuarioId, ids],
  );
}

// ---- Suscripciones push ---------------------------------------------------------

// Si el mismo celular ya estaba suscrito (otro usuario entró en él), queda del nuevo.
export async function guardarSuscripcion(db, usuarioId, { endpoint, keys }) {
  await db.query(
    `INSERT INTO suscripcion_push (usuario_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE
       SET usuario_id = EXCLUDED.usuario_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [usuarioId, endpoint, keys.p256dh, keys.auth],
  );
}

export async function borrarSuscripcion(db, endpoint, usuarioId = null) {
  await db.query(
    'DELETE FROM suscripcion_push WHERE endpoint = $1 AND ($2::bigint IS NULL OR usuario_id = $2)',
    [endpoint, usuarioId],
  );
}

export async function suscripcionesDe(db, usuarioIds) {
  const { rows } = await db.query(
    `SELECT usuario_id AS "usuarioId", endpoint, p256dh, auth
       FROM suscripcion_push WHERE usuario_id = ANY($1::bigint[])`,
    [usuarioIds],
  );
  return rows;
}

// Días de producido que el admin cargó en las últimas `horas`, por buseta (para
// avisarle al conductor). Se lee la tabla del producido directamente: importar
// el módulo producido aquí haría un ciclo (producido usa `notificar`).
export async function producidoCargadoDesde(db, horas) {
  const { rows } = await db.query(
    `SELECT buseta_id AS "busetaId", count(*)::int AS dias, min(fecha) AS desde, max(fecha) AS hasta,
            SUM(ingreso)::bigint AS producido
       FROM producido_diario
      WHERE creado_en >= now() - make_interval(hours => $1)
      GROUP BY buseta_id`,
    [horas],
  );
  return rows;
}
