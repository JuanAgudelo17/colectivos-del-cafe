// Proyección del cierre del mes en curso: si la buseta sigue al mismo ritmo,
// ¿cómo cerraría? Función pura. Es una estimación (se muestra como tal).
//
//   Lo que crece con los días (el producido y lo que depende de él): producido,
//   20 % de la empresa, fondo de reposición (con cupo), peajes, salidas, ACPM y
//   relevos → se escalan por días del mes ÷ días transcurridos.
//   Lo fijo del mes: sueldo del conductor, arriendo, fondo fijo (sin cupo),
//   seguro, mantenimiento, bonos y préstamos → quedan igual.

// Con menos días que estos, la proyección no es confiable y no se hace.
export const DIAS_MINIMOS = 5;

/**
 * @param {object} resumen  el de calcularResumen del mes en curso
 * @param {{diasDelMes: number, diaDeHoy: number, tieneCupo: boolean}} p
 * @returns {{bruto, costos, neto, diasTranscurridos, diasDelMes} | null}
 */
export function proyectarMes(resumen, { diasDelMes, diaDeHoy, tieneCupo }) {
  if (diaDeHoy < DIAS_MINIMOS || diaDeHoy >= diasDelMes) return null;
  const factor = diasDelMes / diaDeHoy;

  const variables =
    resumen.empresa +
    (tieneCupo ? resumen.reposicion : 0) +
    resumen.peajes +
    resumen.salidas +
    resumen.acpm +
    resumen.relevo;
  const fijos =
    resumen.conductor +
    resumen.arriendo +
    (tieneCupo ? 0 : resumen.reposicion) +
    resumen.seguroContractual +
    resumen.mantenimiento +
    resumen.bono +
    resumen.prestamos;

  const bruto = Math.round(resumen.bruto * factor);
  const costos = Math.round(variables * factor) + fijos;
  return { bruto, costos, neto: bruto - costos, diasTranscurridos: diaDeHoy, diasDelMes };
}
