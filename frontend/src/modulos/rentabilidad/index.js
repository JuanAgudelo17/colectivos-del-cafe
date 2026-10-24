import { PaginaRentabilidad } from './PaginaRentabilidad.jsx';

// Lo que otros módulos pueden usar de este (ver docs/MODULOS.md): la vista del
// conductor (mi-rentabilidad) reutiliza la gráfica, el desglose y los cálculos.
export { DesgloseCostos } from './DesgloseCostos.jsx';
export { GraficaMeses } from './GraficaMeses.jsx';
export { diasConRegistro, mesLargo, porDia, porcentaje, promedio } from './utilidades.js';

export default {
  id: 'rentabilidad',
  titulo: 'Rentabilidad',
  icono: 'grafica',
  ruta: 'rentabilidad',
  Pagina: PaginaRentabilidad,
};
