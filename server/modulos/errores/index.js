// Módulo errores: registro de los errores de la app en producción (servidor,
// navegador y revisión diaria) y aviso a los admin. Ver migración 014.
import router from './rutas.js';

export { registrarError } from './registrar.js';

export default {
  ruta: '/errores',
  router,
  restricciones: {},
};
