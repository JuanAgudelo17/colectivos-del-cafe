const CAMPOS = `
  id, origen, mensaje, detalle, ruta, navegador, veces,
  primera_vez AS "primeraVez", ultima_vez AS "ultimaVez", resuelto_en AS "resueltoEn",
  (SELECT nombre FROM usuario u WHERE u.id = e.usuario_id) AS usuario
`;

// Guarda el error o, si ya existía (misma huella), suma una vez más. Si estaba
// marcado como resuelto y vuelve a pasar, se reabre.
export async function guardarError(db, e) {
  const { rows } = await db.query(
    `INSERT INTO error_app AS e (huella, origen, mensaje, detalle, ruta, usuario_id, navegador)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (huella) DO UPDATE
       SET veces = e.veces + 1, ultima_vez = now(), detalle = EXCLUDED.detalle,
           usuario_id = COALESCE(EXCLUDED.usuario_id, e.usuario_id),
           navegador = COALESCE(EXCLUDED.navegador, e.navegador), resuelto_en = NULL
     RETURNING id, mensaje, ruta, origen`,
    [e.huella, e.origen, e.mensaje, e.detalle ?? null, e.ruta ?? null, e.usuarioId ?? null, e.navegador ?? null],
  );
  // De paso se limpian los viejos (resueltos o sin repetirse en 90 días).
  await db.query(`DELETE FROM error_app WHERE ultima_vez < now() - interval '90 days'`);
  return rows[0];
}

// Errores distintos del navegador en las últimas 24 h (tope contra abusos).
export async function erroresNavegadorDelDia(db) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS total FROM error_app WHERE origen = 'navegador' AND primera_vez > now() - interval '1 day'`,
  );
  return rows[0].total;
}

export async function listarErrores(db, { resueltos = false } = {}) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS} FROM error_app e
      WHERE (resuelto_en IS NOT NULL) = $1
      ORDER BY ultima_vez DESC
      LIMIT 100`,
    [resueltos],
  );
  return rows;
}

export async function contarPendientes(db) {
  const { rows } = await db.query(`SELECT count(*)::int AS total FROM error_app WHERE resuelto_en IS NULL`);
  return rows[0].total;
}

export async function marcarResuelto(db, id) {
  const { rowCount } = await db.query(`UPDATE error_app SET resuelto_en = now() WHERE id = $1 AND resuelto_en IS NULL`, [id]);
  return rowCount > 0;
}

export async function adminsActivos(db) {
  const { rows } = await db.query(`SELECT id FROM usuario WHERE rol = 'admin' AND activo`);
  return rows.map((r) => r.id);
}
