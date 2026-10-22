const SELECT_EMPRESA = `
  SELECT e.id, e.nombre, e.nit, e.activo,
         (SELECT count(*)::int FROM buseta b WHERE b.empresa_id = e.id AND b.activo) AS busetas,
         (SELECT count(*)::int FROM usuario u
           WHERE u.empresa_id = e.id AND u.rol = 'conductor' AND u.activo)          AS conductores
    FROM empresa e
`;

// empresaId null = todas.
export async function listarEmpresas(db, empresaId) {
  const { rows } = await db.query(
    `${SELECT_EMPRESA} WHERE ($1::bigint IS NULL OR e.id = $1) ORDER BY e.activo DESC, e.nombre`,
    [empresaId],
  );
  return rows;
}

export async function obtenerEmpresa(db, id) {
  const { rows } = await db.query(`${SELECT_EMPRESA} WHERE e.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function crearEmpresa(db, { nombre, nit }) {
  const { rows } = await db.query('INSERT INTO empresa (nombre, nit) VALUES ($1, $2) RETURNING id', [nombre, nit]);
  return obtenerEmpresa(db, rows[0].id);
}

export async function actualizarEmpresa(db, id, { nombre, nit, activo }) {
  const { rows } = await db.query(
    'UPDATE empresa SET nombre = $2, nit = $3, activo = $4 WHERE id = $1 RETURNING id',
    [id, nombre, nit, activo],
  );
  return rows[0] ? obtenerEmpresa(db, id) : null;
}
