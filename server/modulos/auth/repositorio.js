// Usuario activo para iniciar sesión (incluye el hash para comparar la contraseña).
export async function buscarParaLogin(db, usuario) {
  const { rows } = await db.query(
    `SELECT id, usuario, nombre, rol, buseta_id AS "busetaId", password_hash AS "passwordHash"
       FROM usuario
      WHERE lower(usuario) = lower($1) AND activo`,
    [usuario],
  );
  return rows[0] ?? null;
}
