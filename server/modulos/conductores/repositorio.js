const SELECT_CONDUCTOR = `
  SELECT u.id,
         u.usuario,
         u.nombre,
         u.cedula,
         u.telefono,
         u.buseta_id      AS "busetaId",
         b.placa          AS "busetaPlaca",
         b.numero_interno AS "busetaNumeroInterno",
         u.activo
    FROM usuario u
    LEFT JOIN buseta b ON b.id = u.buseta_id
   WHERE u.rol = 'conductor'
`;

export async function listarConductores(db) {
  const { rows } = await db.query(`${SELECT_CONDUCTOR} ORDER BY u.activo DESC, u.nombre`);
  return rows;
}

export async function obtenerConductor(db, id) {
  const { rows } = await db.query(`${SELECT_CONDUCTOR} AND u.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function crearConductor(db, c, passwordHash) {
  const { rows } = await db.query(
    `INSERT INTO usuario (usuario, nombre, cedula, telefono, buseta_id, password_hash, rol)
     VALUES ($1, $2, $3, $4, $5, $6, 'conductor')
     RETURNING id`,
    [c.usuario, c.nombre, c.cedula, c.telefono, c.busetaId, passwordHash],
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
