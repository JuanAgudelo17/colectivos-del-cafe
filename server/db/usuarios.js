const CAMPOS_SESION = `
  u.id,
  u.usuario,
  u.nombre,
  u.rol,
  u.empresa_id AS "empresaId",
  u.buseta_id  AS "busetaId"
`;

// Usuario activo (y de empresa activa, si tiene) para iniciar sesión.
export async function buscarParaLogin(db, usuario) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS_SESION}, u.password_hash AS "passwordHash"
       FROM usuario u
       LEFT JOIN empresa e ON e.id = u.empresa_id
      WHERE lower(u.usuario) = lower($1)
        AND u.activo
        AND (u.empresa_id IS NULL OR e.activo)`,
    [usuario],
  );
  return rows[0] ?? null;
}

// Usuario de una sesión. Se consulta en cada petición para que desactivar a
// alguien (o a su empresa) le corte el acceso de inmediato.
export async function buscarSesion(db, id) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS_SESION}
       FROM usuario u
       LEFT JOIN empresa e ON e.id = u.empresa_id
      WHERE u.id = $1
        AND u.activo
        AND (u.empresa_id IS NULL OR e.activo)`,
    [id],
  );
  return rows[0] ?? null;
}
