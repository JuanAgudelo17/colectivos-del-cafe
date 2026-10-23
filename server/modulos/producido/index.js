// Módulo producido: registro diario por buseta (admin), consulta del conductor,
// ajustes del mes (bono, préstamos), tarifas de rutas y el cálculo del resumen.
import router from './rutas.js';

export { calcularResumen } from './calculo.js';
export { datosDelAnio, parametrosDelMes, primerAnio, rangoDelMes } from './repositorio.js';

export default {
  ruta: '/producido',
  router,
  restricciones: {},
};
