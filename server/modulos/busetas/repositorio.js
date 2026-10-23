import { DOCUMENTOS, estadoDocumento } from './documentos.js';

const SELECT_BUSETA = `
  SELECT b.id,
         b.numero_interno          AS "numeroInterno",
         b.placa,
         b.modelo,
         b.tiene_cupo              AS "tieneCupo",
         b.valor_arriendo          AS "valorArriendo",
         b.activo,
         b.foto_path               AS "foto",
         d.fecha_soat              AS "fechaSoat",
         d.fecha_tecnomecanica     AS "fechaTecnomecanica",
         d.fecha_tarjeta_operacion AS "fechaTarjetaOperacion",
         d.fecha_poliza_rcc        AS "fechaPolizaRcc",
         d.fecha_poliza_rce        AS "fechaPolizaRce",
         d.fecha_extintor          AS "fechaExtintor",
         u.id                      AS "conductorId",
         u.nombre                  AS "conductorNombre"
    FROM buseta b
    LEFT JOIN documento_buseta d ON d.buseta_id = b.id
    LEFT JOIN usuario u          ON u.buseta_id = b.id
`;

function conDocumentos({ conductorId, conductorNombre, ...buseta }) {
  return {
    ...buseta,
    conductor: conductorId ? { id: conductorId, nombre: conductorNombre } : null,
    documentos: Object.fromEntries(
      Object.entries(DOCUMENTOS).map(([clave, campo]) => [clave, estadoDocumento(buseta[campo])]),
    ),
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

const fechasDocumentos = (b) => [
  b.fechaSoat,
  b.fechaTecnomecanica,
  b.fechaTarjetaOperacion,
  b.fechaPolizaRcc,
  b.fechaPolizaRce,
  b.fechaExtintor,
];

// Buseta y su registro de documentos en una sola sentencia (atómica).
export async function crearBuseta(db, b) {
  const { rows } = await db.query(
    `WITH nueva AS (
       INSERT INTO buseta (numero_interno, placa, modelo, tiene_cupo, valor_arriendo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id
     )
     INSERT INTO documento_buseta (buseta_id, fecha_soat, fecha_tecnomecanica, fecha_tarjeta_operacion,
                                   fecha_poliza_rcc, fecha_poliza_rce, fecha_extintor)
     SELECT id, $6, $7, $8, $9, $10, $11 FROM nueva
     RETURNING buseta_id AS id`,
    [b.numeroInterno, b.placa, b.modelo, b.tieneCupo, b.valorArriendo, ...fechasDocumentos(b)],
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
     INSERT INTO documento_buseta (buseta_id, fecha_soat, fecha_tecnomecanica, fecha_tarjeta_operacion,
                                   fecha_poliza_rcc, fecha_poliza_rce, fecha_extintor)
     SELECT id, $8, $9, $10, $11, $12, $13 FROM editada
     ON CONFLICT (buseta_id) DO UPDATE
       SET fecha_soat = EXCLUDED.fecha_soat,
           fecha_tecnomecanica = EXCLUDED.fecha_tecnomecanica,
           fecha_tarjeta_operacion = EXCLUDED.fecha_tarjeta_operacion,
           fecha_poliza_rcc = EXCLUDED.fecha_poliza_rcc,
           fecha_poliza_rce = EXCLUDED.fecha_poliza_rce,
           fecha_extintor = EXCLUDED.fecha_extintor
     RETURNING buseta_id AS id`,
    [id, b.numeroInterno, b.placa, b.modelo, b.tieneCupo, b.valorArriendo, b.activo, ...fechasDocumentos(b)],
  );
  return rows[0] ? obtenerBuseta(db, id) : null;
}

// Cambia la ruta de la foto (null = quitarla) y devuelve la anterior para borrar el archivo.
export async function cambiarFoto(db, id, fotoPath) {
  const { rows } = await db.query(
    `WITH anterior AS (SELECT foto_path FROM buseta WHERE id = $1)
     UPDATE buseta SET foto_path = $2 WHERE id = $1
     RETURNING (SELECT foto_path FROM anterior) AS anterior`,
    [id, fotoPath],
  );
  return rows[0]?.anterior ?? null;
}
