// Solicitudes de "olvidé mi contraseña". Las atiende el admin generando una
// contraseña temporal (ver asignarPasswordTemporal).

// Solo para conductores activos; si ya hay una pendiente no se duplica, así que
// las filas nunca superan el número de conductores (no hace falta límite por IP).
// La IP queda como registro.
// No dice si el usuario existe: quien llama responde siempre lo mismo.
export async function crearSolicitud(db, usuario, ip) {
  await db.query(
    `INSERT INTO solicitud_recuperacion (usuario_id, ip)
     SELECT id, $2 FROM usuario
      WHERE lower(usuario) = lower($1) AND activo AND rol = 'conductor'
     ON CONFLICT (usuario_id) WHERE atendida_en IS NULL DO NOTHING`,
    [usuario, ip],
  );
}

export async function listarPendientes(db) {
  const { rows } = await db.query(
    `SELECT s.id, s.creado_en AS "creadoEn",
            u.id AS "usuarioId", u.usuario, u.nombre, u.telefono
       FROM solicitud_recuperacion s
       JOIN usuario u ON u.id = s.usuario_id
      WHERE s.atendida_en IS NULL AND u.activo
      ORDER BY s.creado_en`,
  );
  return rows;
}
