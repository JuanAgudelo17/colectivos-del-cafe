// Cálculos de presentación de la rentabilidad (los montos ya vienen del backend).

const formatoPorcentaje = new Intl.NumberFormat('es-CO', { style: 'percent', maximumFractionDigits: 1 });
const nombreCorto = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' });
const nombreLargo = new Intl.DateTimeFormat('es-CO', { month: 'long', timeZone: 'UTC' });

// Parte de `total` que es `valor` ("15,8 %"); sin total no hay porcentaje.
export function porcentaje(valor, total) {
  return total > 0 ? formatoPorcentaje.format(valor / total) : '—';
}

// División para promedios: sin divisor no hay promedio.
export const promedio = (valor, entre) => (entre > 0 ? Math.round(valor / entre) : null);

// 3 → "mar"; 3 → "Marzo"
export const mesCorto = (mes) => nombreCorto.format(new Date(Date.UTC(2026, mes - 1, 1))).replace('.', '');
export const mesLargo = (mes) =>
  nombreLargo.format(new Date(Date.UTC(2026, mes - 1, 1))).replace(/^./, (l) => l.toUpperCase());

// En qué se va la plata, en el mismo orden de la planilla.
export const CONCEPTOS = [
  ['empresa', 'Empresa (Colectivos)'],
  ['reposicion', 'Fondo de reposición'],
  ['conductor', 'Sueldo del conductor'],
  ['acpm', 'ACPM'],
  ['peajes', 'Peajes'],
  ['salidas', 'Salidas'],
  ['mantenimiento', 'Mantenimiento'],
  ['arriendo', 'Arriendo'],
  ['relevo', 'Relevos'],
  ['seguroContractual', 'Seguro contractual'],
  ['prestamos', 'Préstamos'],
  ['bono', 'Bonos'],
];
