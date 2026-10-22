import { estadoDocumento } from './documentos.js';

const SELECT_BUSETA = `
  SELECT b.id,
         b.numero_interno      AS "numeroInterno",
         b.placa,
         b.modelo,
         b.tiene_cupo          AS "tieneCupo",
         b.valor_arriendo      AS "valorArriendo",
         b.activo,
         d.fecha_soat          AS "fechaSoat",
         d.fecha_tecnomecanica AS "fechaTecnomecanica",
         u.id                  AS "conductorId",
         u.nombre              AS "conductorNombre"
    FROM buseta b
    LEFT JOIN documento_buseta d ON d.buseta_id = b.id
    LEFT JOIN usuario u          ON u.buseta_id = b.id
`;

function conDocumentos({ conductorId, conductorNombre, ...buseta }) {
  return {
    ...buseta,
    conductor: conductorId ? { id: conductorId, nombre: conductorNombre } : null,
    documentos: {
      soat: estadoDocumento(buseta.fechaSoat),
      tecnomecanica: estadoDocumento(buseta.fechaTecnomecanica),
    },
  };
}

export async function listarBusetas(db) {
  const { rows } = await db.query(`${SELECT_BUSETA} ORDER BY b.activo DESC, b.numero_interno`);
  return rows.map(conDocumentos);
}

export async function obtenerBuseta(db, id) {
  const { rows } = await db.query(`${SELECT_BUSETA} WHERE b.id = $1`, [id]);
  return rows[0] ? conDocumentos(rows[0]) : null;
}

// Buseta y su registro de documentos en una sola sentencia (atómica).
export async function crearBuseta(db, b) {
  const { rows } = await db.query(
    `WITH nueva AS (
       INSERT INTO buseta (numero_interno, placa, modelo, tiene_cupo, valor_arriendo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id
     )
     INSERT INTO documento_buseta (buseta_id, fecha_soat, fecha_tecnomecanica)
     SELECT id, $6, $7 FROM nueva
     RETURNING buseta_id AS id`,
    [b.numeroInterno, b.placa, b.modelo, b.tieneCupo, b.valorArriendo, b.fechaSoat, b.fechaTecnomecanica],
  );
  return obtenerBuseta(db, rows[0].id);
}

export async function actualizarBuseta(db, id, b) {
  const { rows } = await db.query(
    `WITH editada AS (
       UPDATE buseta
          SET numero_interno = $2, placa = $3, modelo = $4,
              tiene_cupo = $5, valor_arriendo = $6, activo = $7
        WHERE id = $1
        RETURNING id
     )
     INSERT INTO documento_buseta (buseta_id, fecha_soat, fecha_tecnomecanica)
     SELECT id, $8, $9 FROM editada
     ON CONFLICT (buseta_id) DO UPDATE
       SET fecha_soat = EXCLUDED.fecha_soat,
           fecha_tecnomecanica = EXCLUDED.fecha_tecnomecanica
     RETURNING buseta_id AS id`,
    [id, b.numeroInterno, b.placa, b.modelo, b.tieneCupo, b.valorArriendo, b.activo, b.fechaSoat, b.fechaTecnomecanica],
  );
  return rows[0] ? obtenerBuseta(db, id) : null;
}
