// Corre a mano la revisión diaria de recordatorios (la misma de la función
// programada de Netlify). Uso: npm run recordatorios
import { conCliente } from '../compartido/bd/conexion.js';
import { revisarRecordatorios } from '../modulos/notificaciones/index.js';

await conCliente(async (db) => {
  const { creadas, enviadas } = await revisarRecordatorios(db);
  console.log(`✔ ${creadas} avisos nuevos, ${enviadas} enviados al celular.`);
});
