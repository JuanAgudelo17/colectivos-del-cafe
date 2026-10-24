import { crearPool } from '../../server/compartido/bd/pool.js';
import { revisarRecordatorios } from '../../server/modulos/notificaciones/index.js';

// Revisión diaria de recordatorios: todos los días a las 7:00 a. m. de Bogotá
// (12:00 UTC). Netlify solo corre las funciones programadas en el sitio
// publicado (producción), no en previews ni en el sitio de pruebas.
export const config = { schedule: '0 12 * * *' };

export default async () => {
  const db = crearPool();
  try {
    const resultado = await revisarRecordatorios(db);
    console.log(`Recordatorios: ${resultado.creadas} nuevos, ${resultado.enviadas} enviados al celular`);
    return new Response('ok');
  } finally {
    await db.end();
  }
};
