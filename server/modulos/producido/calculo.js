// Cálculo oficial del resumen mensual de una buseta (ver CLAUDE.md, "Fórmula").
// Función pura: recibe los datos y devuelve todos los valores en pesos enteros.
//
//   bruto       = Σ producido del mes
//   empresa     = bruto × porcentaje_empresa
//   reposicion  = bruto × porcentaje_reposicion         (fondo)
//   conductor   = sueldo_conductor
//   relevo      = días de relevo × valor_relevo
//   arriendo    = tiene_cupo ? 0 : valor_arriendo
//   costos      = empresa + reposicion + conductor + Σpeajes + Σsalidas + Σacpm
//                 + Σmantenimiento + arriendo + relevo + bonos + préstamos
//   neto        = bruto − costos

// Los porcentajes llegan como texto NUMERIC ('0.2000'). Se pasan a puntos
// básicos (2000) para multiplicar solo con enteros y no arrastrar errores de
// coma flotante: 11.459.500 × 20 % = 2.291.900 exacto.
const PUNTOS_BASE = 10_000;
const aPuntosBase = (valor) => Math.round(Number(valor) * PUNTOS_BASE);
const aPesos = (valor) => Math.round(Number(valor ?? 0));
const porcentaje = (monto, valor) => Math.round((monto * aPuntosBase(valor)) / PUNTOS_BASE);

const sumar = (lista, campo) => lista.reduce((total, x) => total + aPesos(x[campo]), 0);

/**
 * @param {object} p
 * @param {Array<{ingreso, peajes, salidas, acpm, mantenimiento, relevo}>} p.dias
 * @param {{porcentaje_empresa, porcentaje_reposicion, sueldo_conductor, valor_relevo}} p.parametros
 * @param {{tieneCupo: boolean, valorArriendo: number|null}} p.buseta
 * @param {Array<{tipo: 'bono'|'prestamo', valor: number}>} [p.ajustes]
 */
export function calcularResumen({ dias, parametros, buseta, ajustes = [] }) {
  const bruto = sumar(dias, 'ingreso');
  const diasRelevo = dias.filter((d) => d.relevo).length;

  const descuentos = {
    empresa: porcentaje(bruto, parametros.porcentaje_empresa),
    reposicion: porcentaje(bruto, parametros.porcentaje_reposicion),
    conductor: aPesos(parametros.sueldo_conductor),
    peajes: sumar(dias, 'peajes'),
    salidas: sumar(dias, 'salidas'),
    acpm: sumar(dias, 'acpm'),
    mantenimiento: sumar(dias, 'mantenimiento'),
    arriendo: buseta.tieneCupo ? 0 : aPesos(buseta.valorArriendo),
    relevo: diasRelevo * aPesos(parametros.valor_relevo),
    bono: sumar(
      ajustes.filter((a) => a.tipo === 'bono'),
      'valor',
    ),
    prestamos: sumar(
      ajustes.filter((a) => a.tipo === 'prestamo'),
      'valor',
    ),
  };

  const costos = Object.values(descuentos).reduce((a, b) => a + b, 0);

  return {
    bruto,
    ...descuentos,
    diasTrabajados: dias.filter((d) => aPesos(d.ingreso) > 0).length,
    diasRelevo,
    costos,
    neto: bruto - costos,
  };
}
