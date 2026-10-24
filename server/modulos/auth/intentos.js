export const VENTANA_MIN = 15;
export const MAX_FALLOS_USUARIO = 5;
export const MAX_FALLOS_IP = 20;

// Minutos que faltan para que se levante el bloqueo (0 si no está bloqueado).
// Hay bloqueo mientras el N-ésimo fallo más reciente siga dentro de la ventana;
// se levanta cuando ese fallo sale de ella.
export async function minutosDeBloqueo(db, usuario, ip) {
  const { rows } = await db.query(
    `SELECT ceil(extract(epoch FROM greatest(
              (SELECT creado_en FROM intento_login
                WHERE lower(usuario) = lower($1) AND creado_en > now() - make_interval(mins => $3)
                ORDER BY creado_en DESC OFFSET $4 LIMIT 1),
              (SELECT creado_en FROM intento_login
                WHERE ip = $2 AND creado_en > now() - make_interval(mins => $3)
                ORDER BY creado_en DESC OFFSET $5 LIMIT 1)
            ) + make_interval(mins => $3) - now()) / 60)::int AS minutos`,
    [usuario, ip, VENTANA_MIN, MAX_FALLOS_USUARIO - 1, MAX_FALLOS_IP - 1],
  );
  return Math.max(rows[0].minutos ?? 0, 0);
}

export async function registrarFallo(db, usuario, ip) {
  await db.query('INSERT INTO intento_login (usuario, ip) VALUES ($1, $2)', [usuario, ip]);
  // Limpieza: los intentos de más de un día ya no sirven para nada.
  await db.query(`DELETE FROM intento_login WHERE creado_en < now() - interval '1 day'`);
}

export async function limpiarFallos(db, usuario) {
  await db.query('DELETE FROM intento_login WHERE lower(usuario) = lower($1)', [usuario]);
}
