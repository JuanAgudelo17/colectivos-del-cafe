// Módulo facturas: soporte de los gastos (peajes, mantenimiento, ACPM, salidas)
// con foto opcional. Las registra el conductor (en su buseta) o el admin.
// Son solo respaldo: no alimentan el cálculo del mes (eso sale de la cuadrícula).
import router from './rutas.js';

export default {
  ruta: '/facturas',
  router,
  restricciones: {},
};
