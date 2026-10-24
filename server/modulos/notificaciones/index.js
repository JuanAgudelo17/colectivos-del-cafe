// Módulo notificaciones: recordatorios diarios (documentos por vencer,
// mantenimientos, kilometraje sin reportar, peajes Colpass), la campanita de
// avisos de cada usuario y las notificaciones push al celular.
import router from './rutas.js';

export { enviadorDesdeEntorno } from './envio.js';
export { revisarRecordatorios } from './revisar.js';

export default {
  ruta: '/notificaciones',
  router,
  restricciones: {},
};
