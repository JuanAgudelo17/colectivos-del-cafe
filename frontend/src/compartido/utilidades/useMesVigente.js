import { hoyBogota, mesActual } from './formato.js';
import { useDatos } from './useDatos.js';

// Hasta este día del mes, si el mes nuevo todavía no tiene datos, se muestra el
// anterior: el producido de octubre se carga y se consulta los primeros días de
// noviembre, y no debe "desaparecer" solo porque noviembre está vacío.
export const DIA_LIMITE_MES_ANTERIOR = 15;

export function mesAnterior({ anio, mes }) {
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
}

// Carga el mes que conviene mostrar por defecto: el actual o, en los primeros
// 15 días y mientras el actual esté vacío, el anterior (si ese sí tiene datos).
// `ruta({ anio, mes })` arma la consulta; `tieneDatos(datos)` dice si el mes trae algo.
// `activo: false` no carga nada (ej. cuando el usuario ya eligió un mes).
// Devuelve lo mismo que useDatos más `periodo` y `deMesAnterior`.
export function useMesVigente(ruta, tieneDatos, { activo = true } = {}) {
  const actual = mesActual();
  const anterior = mesAnterior(actual);
  const enPlazo = Number(hoyBogota().slice(8)) <= DIA_LIMITE_MES_ANTERIOR;

  const delActual = useDatos(activo ? ruta(actual) : null);
  const probarAnterior = activo && enPlazo && delActual.datos != null && !tieneDatos(delActual.datos);
  const delAnterior = useDatos(probarAnterior ? ruta(anterior) : null);

  // Mientras se averigua si el anterior tiene datos, no se muestra el actual vacío.
  if (probarAnterior && !delAnterior.datos && !delAnterior.error) {
    return { ...delAnterior, datos: null, cargando: true, periodo: anterior, deMesAnterior: true };
  }
  if (probarAnterior && delAnterior.datos && tieneDatos(delAnterior.datos)) {
    return { ...delAnterior, periodo: anterior, deMesAnterior: true };
  }
  return { ...delActual, periodo: actual, deMesAnterior: false };
}
