const CAMPOS = `
  f.id, f.buseta_id AS "busetaId", f.conductor_id AS "conductorId", to_char(f.fecha, 'YYYY-MM-DD') AS fecha,
  f.categoria, f.descripcion, f.precio, f.imagen_path AS "imagenPath", f.creado_en AS "creadoEn",
  b.numero_interno AS "numeroInterno", b.placa, u.nombre AS conductor
`;
const DESDE = `FROM factura f JOIN buseta b ON b.id = f.buseta_id JOIN usuario u ON u.id = f.conductor_id`;

export async function crearFactura(db, f) {
  const { rows } = await db.query(
    `INSERT INTO factura (conductor_id, buseta_id, fecha, categoria, descripcion, precio)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [f.conductorId, f.busetaId, f.fecha, f.categoria, f.descripcion, f.precio],
  );
  return obtenerFactura(db, rows[0].id);
}

export async function obtenerFactura(db, id) {
  const { rows } = await db.query(`SELECT ${CAMPOS} ${DESDE} WHERE f.id = $1`, [id]);
  return rows[0] ?? null;
}

// Facturas del mes; `busetaId` null = todas (admin).
export async function listarFacturas(db, { desde, hasta, busetaId = null }) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS} ${DESDE}
      WHERE f.fecha BETWEEN $1 AND $2 AND ($3::bigint IS NULL OR f.buseta_id = $3)
      ORDER BY f.fecha DESC, f.id DESC`,
    [desde, hasta, busetaId],
  );
  return rows;
}

// Cambia la foto y devuelve la ruta anterior (para borrarla del bucket).
export async function cambiarImagen(db, id, ruta) {
  const { rows } = await db.query(
    `UPDATE factura f SET imagen_path = $2
       FROM (SELECT imagen_path FROM factura WHERE id = $1) anterior
      WHERE f.id = $1
      RETURNING anterior.imagen_path AS anterior`,
    [id, ruta],
  );
  return rows[0]?.anterior ?? null;
}

export async function borrarFactura(db, id) {
  await db.query('DELETE FROM factura WHERE id = $1', [id]);
}
