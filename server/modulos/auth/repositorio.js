import { HORAS_PASSWORD_TEMPORAL } from '../../compartido/seguridad/passwords.js';

// Usuario activo para iniciar sesión (incluye el hash para comparar la contraseña).
export async function buscarParaLogin(db, usuario) {
  const { rows } = await db.query(
    `SELECT id, usuario, nombre, rol,
            buseta_id             AS "busetaId",
            debe_cambiar_password AS "debeCambiarPassword",
            sesion_version        AS "sesionVersion",
            password_hash         AS "passwordHash",
            (password_temporal_hasta IS NOT NULL AND password_temporal_hasta < now()) AS "temporalVencida"
       FROM usuario
      WHERE lower(usuario) = lower($1) AND activo`,
    [usuario],
  );
  return rows[0] ?? null;
}

export async function obtenerHash(db, id) {
  const { rows } = await db.query('SELECT password_hash AS "passwordHash" FROM usuario WHERE id = $1', [id]);
  return rows[0]?.passwordHash ?? null;
}

// Contraseña elegida por el usuario. Sube sesion_version: las demás sesiones se cierran.
export async function guardarPasswordPropia(db, id, passwordHash) {
  const { rows } = await db.query(
    `UPDATE usuario
        SET password_hash = $2,
            debe_cambiar_password = FALSE,
            password_temporal_hasta = NULL,
            sesion_version = sesion_version + 1
      WHERE id = $1
      RETURNING sesion_version AS "sesionVersion"`,
    [id, passwordHash],
  );
  return rows[0].sesionVersion;
}

// Contraseña temporal generada por el sistema (restablecer / recuperar):
// vence en 48 h, obliga a crear una propia, cierra sesiones abiertas y da por
// atendidas las solicitudes de recuperación pendientes.
export async function asignarPasswordTemporal(db, id, passwordHash, atendidaPor = null) {
  const { rowCount } = await db.query(
    `UPDATE usuario
        SET password_hash = $2,
            debe_cambiar_password = TRUE,
            password_temporal_hasta = now() + make_interval(hours => $3),
            sesion_version = sesion_version + 1
      WHERE id = $1`,
    [id, passwordHash, HORAS_PASSWORD_TEMPORAL],
  );
  await db.query(
    `UPDATE solicitud_recuperacion SET atendida_en = now(), atendida_por = $2
      WHERE usuario_id = $1 AND atendida_en IS NULL`,
    [id, atendidaPor],
  );
  return rowCount === 1;
}
