const SELECT_CONDUCTOR = `
  SELECT u.id,
         u.empresa_id     AS "empresaId",
         e.nombre         AS "empresaNombre",
         u.usuario,
         u.nombre,
         u.cedula,
         u.telefono,
         u.buseta_id      AS "busetaId",
         b.placa          AS "busetaPlaca",
         b.numero_interno AS "busetaNumeroInterno",
         u.activo
    FROM usuario u
    JOIN empresa e     ON e.id = u.empresa_id
    LEFT JOIN buseta b ON b.id = u.buseta_id
   WHERE u.rol = 'conductor'
`;

// empresaId null = todas.
export async function listarConductores(db, empresaId) {
  const { rows } = await db.query(
    `${SELECT_CONDUCTOR}
       AND ($1::bigint IS NULL OR u.empresa_id = $1)
     ORDER BY u.activo DESC, e.nombre, u.nombre`,
    [empresaId],
  );
  return rows;
}

export async function obtenerConductor(db, id) {
  const { rows } = await db.query(`${SELECT_CONDUCTOR} AND u.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function crearConductor(db, c, passwordHash) {
  const { rows } = await db.query(
    `INSERT INTO usuario (empresa_id, usuario, nombre, cedula, telefono, buseta_id, password_hash, rol)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'conductor')
     RETURNING id`,
    [c.empresaId, c.usuario, c.nombre, c.cedula, c.telefono, c.busetaId, passwordHash],
  );
  return obtenerConductor(db, rows[0].id);
}

export async function actualizarConductor(db, id, c) {
  const { rows } = await db.query(
    `UPDATE usuario
        SET usuario = $2, nombre = $3, cedula = $4, telefono = $5, buseta_id = $6, activo = $7
      WHERE id = $1 AND rol = 'conductor'
      RETURNING id`,
    [id, c.usuario, c.nombre, c.cedula, c.telefono, c.busetaId, c.activo],
  );
  return rows[0] ? obtenerConductor(db, id) : null;
}

export async function cambiarPassword(db, id, passwordHash) {
  const { rowCount } = await db.query(
    `UPDATE usuario SET password_hash = $2 WHERE id = $1 AND rol = 'conductor'`,
    [id, passwordHash],
  );
  return rowCount === 1;
}
