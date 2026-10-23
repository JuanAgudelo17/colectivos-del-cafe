// Cálculo oficial del resumen mensual de una buseta (ver CLAUDE.md, "Fórmula").
// Función pura: recibe los datos y devuelve todos los valores en pesos enteros.
//
//   bruto        = Σ producido del mes
//   empresa      = bruto × porcentaje_empresa
//   reposicion   = con cupo: bruto × porcentaje_reposicion
//                  sin cupo (paga arriendo): fondo_fijo_arriendo
//   conductor    = sueldo_conductor
//   acpm         = Σ ACPM que paga el conductor + Σ ACPM a crédito (La Guaca)
//   mantenimiento= Σ mantenimiento diario + Σ ajustes de mantenimiento del mes
//   arriendo     = tiene_cupo ? 0 : valor_arriendo
//   relevo       = días de relevo × valor_relevo
//   seguro       = seguro_contractual, solo de febrero a julio
//   costos       = empresa + reposicion + conductor + Σpeajes + Σsalidas + acpm
//                  + mantenimiento + arriendo + relevo + seguro + bonos + préstamos
//   neto         = bruto − costos

// Los porcentajes llegan como texto NUMERIC ('0.2000'). Se pasan a puntos
// básicos (2000) para multiplicar solo con enteros y no arrastrar errores de
// coma flotante: 11.459.500 × 20 % = 2.291.900 exacto.
const PUNTOS_BASE = 10_000;
const aPuntosBase = (valor) => Math.round(Number(valor) * PUNTOS_BASE);
const aPesos = (valor) => Math.round(Number(valor ?? 0));
const porcentaje = (monto, valor) => Math.round((monto * aPuntosBase(valor)) / PUNTOS_BASE);

const sumar = (lista, campo) => lista.reduce((total, x) => total + aPesos(x[campo]), 0);
const sumarTipo = (ajustes, tipo) => sumar(
  ajustes.filter((a) => a.tipo === tipo),
  'valor',
);

// Meses en que se paga el seguro contractual (febrero a julio).
export const MESES_SEGURO_CONTRACTUAL = [2, 3, 4, 5, 6, 7];

/**
 * @param {object} p
 * @param {Array<{ingreso, peajes, salidas, acpm, acpmCredito, mantenimiento, relevo}>} p.dias
 * @param {Record<string, string>} p.parametros  vigentes en el mes (clave → valor)
 * @param {{tieneCupo: boolean, valorArriendo: number|null}} p.buseta
 * @param {Array<{tipo: 'bono'|'prestamo'|'mantenimiento', valor: number}>} [p.ajustes]
 * @param {number} p.mes  1-12 (para el seguro contractual)
 */
export function calcularResumen({ dias, parametros, buseta, ajustes = [], mes }) {
  const bruto = sumar(dias, 'ingreso');
  const diasRelevo = dias.filter((d) => d.relevo).length;
  const acpmConductor = sumar(dias, 'acpm');
  const acpmCredito = sumar(dias, 'acpmCredito');

  const descuentos = {
    empresa: porcentaje(bruto, parametros.porcentaje_empresa),
    reposicion: buseta.tieneCupo
      ? porcentaje(bruto, parametros.porcentaje_reposicion)
      : aPesos(parametros.fondo_fijo_arriendo),
    conductor: aPesos(parametros.sueldo_conductor),
    peajes: sumar(dias, 'peajes'),
    salidas: sumar(dias, 'salidas'),
    acpm: acpmConductor + acpmCredito,
    mantenimiento: sumar(dias, 'mantenimiento') + sumarTipo(ajustes, 'mantenimiento'),
    arriendo: buseta.tieneCupo ? 0 : aPesos(buseta.valorArriendo),
    relevo: diasRelevo * aPesos(parametros.valor_relevo),
    seguroContractual: MESES_SEGURO_CONTRACTUAL.includes(mes) ? aPesos(parametros.seguro_contractual) : 0,
    bono: sumarTipo(ajustes, 'bono'),
    prestamos: sumarTipo(ajustes, 'prestamo'),
  };

  const costos = Object.values(descuentos).reduce((a, b) => a + b, 0);

  return {
    bruto,
    ...descuentos,
    // Detalle del ACPM: lo que pagó el conductor y lo que se debe a la bomba a crédito.
    acpmConductor,
    acpmCredito,
    fondoFijo: !buseta.tieneCupo,
    diasTrabajados: dias.filter((d) => aPesos(d.ingreso) > 0).length,
    diasRelevo,
    costos,
    // Neto antes de combustible (la planilla lo llama "Total bruto").
    netoAntesAcpm: bruto - (costos - descuentos.acpm),
    neto: bruto - costos,
  };
}
