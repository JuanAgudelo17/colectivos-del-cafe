// Liquidación mensual de la cooperativa ("Liquidación mensual de vehículos").
// Funciones puras: de las líneas del documento al cierre del mes, y del cierre
// al mismo resumen que da calcularResumen (para que todo lo demás lo use igual).

// Descuentos operativos y de nómina, en el orden del documento.
export const DESCUENTOS_OPERATIVOS = [
  'administracion',
  'polizas',
  'fondoReposicion',
  'salidas',
  'combustibles',
  'peajes',
  'prestamos',
];

export const DESCUENTOS_NOMINA = [
  'salarioConductor',
  'prestacionesConductor',
  'seguridadSocialConductor',
  'salarioRelevo',
  'prestacionesRelevo',
  'seguridadSocialRelevo',
  'vacacionesRelevo',
];

const sumar = (l, campos) => campos.reduce((t, c) => t + (l[c] ?? 0), 0);

// Neto a pagar que da la cuenta: total bruto − todos los descuentos.
export const netoDeLiquidacion = (l) =>
  l.totalBruto - sumar(l, DESCUENTOS_OPERATIVOS) - sumar(l, DESCUENTOS_NOMINA);

// Valores del cierre (columnas de cierre_mensual) a partir de la liquidación.
// La nómina del conductor (salario + prestaciones + seguridad social) va como
// "conductor"; la del relevo, como "relevo".
export function cierreDeLiquidacion(l) {
  return {
    bruto: l.totalBruto,
    empresa: l.administracion,
    reposicion: l.fondoReposicion,
    polizas: l.polizas,
    salidas: l.salidas,
    acpm: l.combustibles,
    peajes: l.peajes,
    prestamos: l.prestamos,
    conductor: l.salarioConductor + l.prestacionesConductor + l.seguridadSocialConductor,
    relevo: l.salarioRelevo + l.prestacionesRelevo + l.seguridadSocialRelevo + l.vacacionesRelevo,
    mantenimiento: 0,
    arriendo: 0,
    bono: 0,
    neto: netoDeLiquidacion(l),
  };
}

// El cierre con la misma forma que calcularResumen. `dias` = los del producido
// de ese mes (si hay): para contar días trabajados y, en un cierre de la app,
// separar el ACPM del conductor del de La Guaca (los días no cambian con el mes cerrado).
export function resumenDeCierre(cierre, dias = []) {
  const deLiquidacion = cierre.origen === 'liquidacion';
  const acpmCredito = deLiquidacion ? 0 : dias.reduce((t, d) => t + Number(d.acpmCredito ?? 0), 0);
  const costos =
    cierre.empresa +
    cierre.reposicion +
    cierre.conductor +
    cierre.peajes +
    cierre.salidas +
    cierre.acpm +
    cierre.mantenimiento +
    cierre.arriendo +
    cierre.relevo +
    cierre.polizas +
    cierre.bono +
    cierre.prestamos;
  return {
    bruto: cierre.bruto,
    empresa: cierre.empresa,
    reposicion: cierre.reposicion,
    conductor: cierre.conductor,
    peajes: cierre.peajes,
    salidas: cierre.salidas,
    acpm: cierre.acpm,
    mantenimiento: cierre.mantenimiento,
    arriendo: cierre.arriendo,
    relevo: cierre.relevo,
    seguroContractual: cierre.polizas,
    bono: cierre.bono,
    prestamos: cierre.prestamos,
    acpmConductor: cierre.acpm - acpmCredito,
    acpmCredito,
    // Sin cupo (paga arriendo) el fondo es fijo; la liquidación no tiene arriendo.
    fondoFijo: cierre.arriendo > 0,
    diasTrabajados: dias.filter((d) => Number(d.ingreso) > 0).length,
    diasRelevo: dias.filter((d) => d.relevo).length,
    costos,
    netoAntesAcpm: cierre.bruto - (costos - cierre.acpm),
    neto: cierre.neto,
    deLiquidacion,
  };
}

// Columnas de cierre_mensual a partir de calcularResumen (cierre hecho por la app).
export const cierreDeResumen = (r) => ({
  bruto: r.bruto,
  reposicion: r.reposicion,
  empresa: r.empresa,
  conductor: r.conductor,
  peajes: r.peajes,
  salidas: r.salidas,
  mantenimiento: r.mantenimiento,
  arriendo: r.arriendo,
  acpm: r.acpm,
  neto: r.neto,
  polizas: r.seguroContractual,
  prestamos: r.prestamos,
  relevo: r.relevo,
  bono: r.bono,
});
