import { HORAS_PASSWORD_TEMPORAL } from '../../compartido/seguridad/passwords.js';

const SELECT_CONDUCTOR = `
  SELECT u.id,
         u.usuario,
         u.nombre,
         u.cedula,
         u.telefono,
         u.buseta_id      AS "busetaId",
         b.placa          AS "busetaPlaca",
         b.numero_interno AS "busetaNumeroInterno",
         u.debe_cambiar_password AS "debeCambiarPassword",
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

// Se crea con una contraseña temporal: al entrar debe crear la suya.
export async function crearConductor(db, c, passwordHash) {
  const { rows } = await db.query(
    `INSERT INTO usuario (usuario, nombre, cedula, telefono, buseta_id, password_hash, rol,
                          debe_cambiar_password, password_temporal_hasta)
     VALUES ($1, $2, $3, $4, $5, $6, 'conductor', TRUE, now() + make_interval(hours => $7))
     RETURNING id`,
    [c.usuario, c.nombre, c.cedula, c.telefono, c.busetaId, passwordHash, HORAS_PASSWORD_TEMPORAL],
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
