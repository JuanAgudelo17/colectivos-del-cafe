// Rentabilidad del año: junta los días y ajustes de cada buseta por mes, calcula
// cada mes con la fórmula oficial (calcularResumen del producido) y acumula
// totales por buseta y de la flota. Función pura, sin base de datos.
import { calcularResumen } from '../producido/index.js';

// Campos del resumen mensual que tiene sentido sumar entre meses o busetas.
export const CAMPOS_SUMABLES = [
  'bruto',
  'empresa',
  'reposicion',
  'conductor',
  'peajes',
  'salidas',
  'acpm',
  'acpmConductor',
  'acpmCredito',
  'mantenimiento',
  'arriendo',
  'relevo',
  'seguroContractual',
  'bono',
  'prestamos',
  'costos',
  'netoAntesAcpm',
  'neto',
  'diasTrabajados',
  'diasRelevo',
];

export function acumular(resumenes) {
  const total = Object.fromEntries(CAMPOS_SUMABLES.map((c) => [c, 0]));
  for (const r of resumenes) {
    for (const c of CAMPOS_SUMABLES) total[c] += r[c];
  }
  return total;
}

/**
 * @param {object} p
 * @param {number} p.anio
 * @param {{anio: number, mes: number}} p.mesActual  hoy en Bogotá
 * @param {Array<{id, tieneCupo, valorArriendo, activo}>} p.busetas
 * @param {Array<{busetaId, mes}>} p.dias      días del año (con los campos del producido)
 * @param {Array<{busetaId, mes, tipo, valor}>} p.ajustes
 * @param {Record<number, Record<string, string>>} p.parametrosPorMes  mes → parámetros vigentes
 */
export function armarAnio({ anio, mesActual, busetas, dias, ajustes, parametrosPorMes }) {
  // Hasta el mes actual: los meses que no han llegado no cuentan.
  const ultimoMes = anio < mesActual.anio ? 12 : anio === mesActual.anio ? mesActual.mes : 0;
  const meses = Array.from({ length: ultimoMes }, (_, i) => i + 1);
  const enCurso = (mes) => anio === mesActual.anio && mes === mesActual.mes;
  const de = (lista, busetaId, mes) => lista.filter((x) => x.busetaId === busetaId && x.mes === mes);

  const porBuseta = busetas
    .map((buseta) => {
      // Solo meses con algo registrado: un mes vacío no es una pérdida, es un mes sin datos
      // (si se calculara, el sueldo y el arriendo lo dejarían en negativo).
      const delAnio = meses.flatMap((mes) => {
        const diasMes = de(dias, buseta.id, mes);
        const ajustesMes = de(ajustes, buseta.id, mes);
        if (diasMes.length === 0 && ajustesMes.length === 0) return [];
        const resumen = calcularResumen({
          dias: diasMes,
          ajustes: ajustesMes,
          parametros: parametrosPorMes[mes],
          buseta,
          mes,
        });
        return [{ mes, enCurso: enCurso(mes), ...resumen }];
      });
      return { buseta, meses: delAnio, total: acumular(delAnio) };
    })
    // Las desactivadas solo aparecen si trabajaron ese año.
    .filter(({ buseta, meses: delAnio }) => buseta.activo || delAnio.length > 0);

  const flotaMeses = meses.flatMap((mes) => {
    const delMes = porBuseta.flatMap((b) => b.meses.filter((m) => m.mes === mes));
    return delMes.length === 0 ? [] : [{ mes, enCurso: enCurso(mes), busetas: delMes.length, ...acumular(delMes) }];
  });

  return {
    anio,
    ultimoMes,
    busetas: porBuseta,
    flota: {
      meses: flotaMeses,
      total: acumular(porBuseta.flatMap((b) => b.meses)),
    },
  };
}
