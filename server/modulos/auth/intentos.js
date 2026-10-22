export const VENTANA_MIN = 15;
export const MAX_FALLOS_USUARIO = 5;
export const MAX_FALLOS_IP = 20;

export async function estaBloqueado(db, usuario, ip) {
  const { rows } = await db.query(
    `SELECT count(*) FILTER (WHERE lower(usuario) = lower($1))::int AS "porUsuario",
            count(*) FILTER (WHERE ip = $2)::int                   AS "porIp"
       FROM intento_login
      WHERE creado_en > now() - make_interval(mins => $3)`,
    [usuario, ip, VENTANA_MIN],
  );
  const { porUsuario, porIp } = rows[0];
  return porUsuario >= MAX_FALLOS_USUARIO || porIp >= MAX_FALLOS_IP;
}

export async function registrarFallo(db, usuario, ip) {
  await db.query('INSERT INTO intento_login (usuario, ip) VALUES ($1, $2)', [usuario, ip]);
  // Limpieza: los intentos de más de un día ya no sirven para nada.
  await db.query(`DELETE FROM intento_login WHERE creado_en < now() - interval '1 day'`);
}

export async function limpiarFallos(db, usuario) {
  await db.query('DELETE FROM intento_login WHERE lower(usuario) = lower($1)', [usuario]);
}
