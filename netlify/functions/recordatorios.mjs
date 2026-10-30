import { crearPool } from '../../server/compartido/bd/pool.js';
import { registrarError } from '../../server/modulos/errores/index.js';
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
  } catch (err) {
    // Que el admin se entere (registro de errores y aviso) y Netlify lo marque como fallida.
    await registrarError(db, { origen: 'programada', mensaje: err.message, detalle: err.stack, ruta: 'Revisión diaria' });
    throw err;
  } finally {
    await db.end();
  }
};
