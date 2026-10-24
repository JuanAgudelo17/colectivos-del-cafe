// Módulo colpass: busetas con Colpass guardan la plata de los peajes que les da
// la empresa. El conductor consulta cuánto lleva (de una fecha a otra) y el admin
// liquida rangos de días cuando le entregan la plata.
import router from './rutas.js';

export { pendientesColpass } from './cuenta.js';

export default {
  ruta: '/colpass',
  router,
  restricciones: {},
};
