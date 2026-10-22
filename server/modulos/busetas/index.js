// Módulo busetas: flota, cupo/arriendo y vencimiento de SOAT y tecnomecánica.
import router from './rutas.js';

export { obtenerBuseta } from './repositorio.js';

export default {
  ruta: '/busetas',
  router,
  restricciones: {
    buseta_placa_key: [409, 'placa', 'Ya existe una buseta con esa placa'],
    buseta_numero_interno_key: [409, 'numeroInterno', 'Ya existe una buseta con ese número interno'],
  },
};
