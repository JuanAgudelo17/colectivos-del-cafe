// Conciliación planilla vs. cooperativa: el mes calculado con los días de la
// cuadrícula (calcularResumen) frente a la liquidación de la cooperativa, línea
// por línea. Función pura.
//
// diferencia = cooperativa − planilla. En un descuento, positiva = la
// cooperativa descontó más; en el producido y el neto, positiva = la
// cooperativa reporta más.

const nominaConductor = (l) => l.salarioConductor + l.prestacionesConductor + l.seguridadSocialConductor;
const nominaRelevo = (l) => l.salarioRelevo + l.prestacionesRelevo + l.seguridadSocialRelevo + l.vacacionesRelevo;

const SOLO_PLANILLA = 'La cooperativa no lo descuenta';
const laGuaca = (l) => l.combustibleLaGuaca ?? 0;

export const LINEAS_CONCILIACION = [
  { clave: 'bruto', nombre: 'Producido', planilla: (r) => r.bruto, cooperativa: (l) => l.totalBruto },
  { clave: 'empresa', nombre: 'Administración (empresa)', planilla: (r) => r.empresa, cooperativa: (l) => l.administracion },
  { clave: 'reposicion', nombre: 'Fondo de reposición', planilla: (r) => r.reposicion, cooperativa: (l) => l.fondoReposicion },
  { clave: 'conductor', nombre: 'Nómina del conductor', planilla: (r) => r.conductor, cooperativa: nominaConductor },
  { clave: 'relevo', nombre: 'Relevo', planilla: (r) => r.relevo, cooperativa: nominaRelevo },
  { clave: 'peajes', nombre: 'Peajes', planilla: (r) => r.peajes, cooperativa: (l) => l.peajes },
  { clave: 'salidas', nombre: 'Salidas', planilla: (r) => r.salidas, cooperativa: (l) => l.salidas },
  { clave: 'acpm', nombre: 'Combustible (ACPM)', planilla: (r) => r.acpm - (r.acpmCredito ?? 0), cooperativa: (l) => l.combustibles },
  // No es de la cooperativa: se carga con la cuenta de cobro de la bomba.
  { clave: 'acpmCredito', nombre: 'ACPM La Guaca', planilla: (r) => r.acpmCredito ?? 0, cooperativa: laGuaca, nota: 'Cuenta de cobro de La Guaca' },
  { clave: 'polizas', nombre: 'Pólizas / seguro', planilla: (r) => r.seguroContractual, cooperativa: (l) => l.polizas },
  { clave: 'prestamos', nombre: 'Préstamos', planilla: (r) => r.prestamos, cooperativa: (l) => l.prestamos },
  { clave: 'mantenimiento', nombre: 'Mantenimiento', planilla: (r) => r.mantenimiento, cooperativa: () => 0, nota: SOLO_PLANILLA },
  { clave: 'arriendo', nombre: 'Arriendo', planilla: (r) => r.arriendo, cooperativa: () => 0, nota: SOLO_PLANILLA },
  { clave: 'bono', nombre: 'Bono', planilla: (r) => r.bono, cooperativa: () => 0, nota: SOLO_PLANILLA },
];

/**
 * @param {object} planilla  resultado de calcularResumen con los días del mes
 * @param {object} liquidacion  el documento de la cooperativa (líneas en pesos)
 * @returns {{ lineas, neto, cuadra }}  `lineas` sin las que están en cero en ambos lados.
 */
export function conciliar(planilla, liquidacion) {
  const lineas = LINEAS_CONCILIACION.map(({ clave, nombre, planilla: p, cooperativa: c, nota }) => {
    const deLaPlanilla = p(planilla);
    const deLaCooperativa = c(liquidacion);
    return {
      clave,
      nombre,
      planilla: deLaPlanilla,
      cooperativa: deLaCooperativa,
      diferencia: deLaCooperativa - deLaPlanilla,
      ...(nota && (deLaPlanilla !== 0 || deLaCooperativa !== 0) && { nota }),
    };
  }).filter((l) => l.planilla !== 0 || l.cooperativa !== 0);

  // El neto de la cooperativa, ya sin el combustible de La Guaca (como la planilla).
  const netoFinal = liquidacion.netoAPagar - laGuaca(liquidacion);
  const neto = { planilla: planilla.neto, cooperativa: netoFinal, diferencia: netoFinal - planilla.neto };
  return { lineas, neto, cuadra: lineas.every((l) => l.diferencia === 0) };
}
