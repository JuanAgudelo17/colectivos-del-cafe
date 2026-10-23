import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularResumen } from './calculo.js';

// Planilla real de la buseta 2033 (un mes completo, como la lleva el admin en Excel).
// [día, producido, peajes, salidas, acpm]
const PLANILLA_2033 = [
  [1, 630000, 89400, 38300, 0],
  [2, 513500, 84800, 14200, 81610],
  [3, 767000, 127200, 21300, 56754],
  [4, 892500, 169600, 28400, 83713],
  [5, 731000, 136400, 69500, 0],
  [6, 756000, 127200, 21300, 132407],
  [7, 315500, 63600, 7100, 141704],
  [8, 319500, 84800, 7100, 56557],
  [9, 289500, 42400, 7100, 30999],
  [13, 414000, 84800, 14200, 67025],
  [15, 485000, 89400, 38300, 85136],
  [17, 362000, 84800, 14200, 64791],
  [19, 365500, 84800, 14200, 69314],
  [21, 680500, 127200, 21300, 89013],
  [23, 432000, 89400, 38300, 82804],
  [24, 487500, 84800, 14200, 62930],
  [26, 598500, 131800, 45400, 111252],
  [27, 756500, 127200, 21300, 81000],
  [29, 638500, 127200, 21300, 83297],
  [30, 501000, 127200, 21300, 78621],
  [31, 524000, 84800, 14200, 55374],
].map(([, ingreso, peajes, salidas, acpm]) => ({ ingreso, peajes, salidas, acpm, mantenimiento: 0, relevo: false }));

// Así llegan los parámetros desde la BD (NUMERIC como texto).
const PARAMETROS = {
  porcentaje_empresa: '0.2000',
  porcentaje_reposicion: '0.0100',
  sueldo_conductor: '3066000.0000',
  valor_relevo: '132000.0000',
  fondo_fijo_arriendo: '70000.0000',
};

const CON_CUPO = { tieneCupo: true, valorArriendo: null };

test('la planilla real de la buseta 2033 da exactamente el neto del Excel', () => {
  const r = calcularResumen({ dias: PLANILLA_2033, parametros: PARAMETROS, buseta: CON_CUPO });

  assert.equal(r.bruto, 11_459_500);
  assert.equal(r.empresa, 2_291_900);
  assert.equal(r.reposicion, 114_595);
  assert.equal(r.conductor, 3_066_000);
  assert.equal(r.peajes, 2_168_800);
  assert.equal(r.salidas, 492_500);
  assert.equal(r.acpm, 1_514_301);
  assert.equal(r.arriendo, 0);
  assert.equal(r.relevo, 0);
  assert.equal(r.neto, 1_811_404);
  assert.equal(r.diasTrabajados, 21);
});

test('cada día de relevo descuenta el valor del parámetro', () => {
  const dias = PLANILLA_2033.map((d, i) => ({ ...d, relevo: i < 2 }));
  const r = calcularResumen({ dias, parametros: PARAMETROS, buseta: CON_CUPO });
  assert.equal(r.diasRelevo, 2);
  assert.equal(r.relevo, 264_000);
  assert.equal(r.neto, 1_811_404 - 264_000);
});

test('bono y préstamos restan del neto; el 20 % sigue sobre el bruto completo', () => {
  const ajustes = [
    { tipo: 'bono', valor: 50_000 },
    { tipo: 'prestamo', valor: 200_000 },
    { tipo: 'prestamo', valor: 100_000 },
  ];
  const r = calcularResumen({ dias: PLANILLA_2033, parametros: PARAMETROS, buseta: CON_CUPO, ajustes });
  assert.equal(r.bono, 50_000);
  assert.equal(r.prestamos, 300_000);
  assert.equal(r.empresa, 2_291_900);
  assert.equal(r.neto, 1_811_404 - 350_000);
});

test('sin cupo: descuenta el arriendo y el fondo es fijo; el mantenimiento se suma', () => {
  const dias = [{ ingreso: 1_000_000, peajes: 0, salidas: 0, acpm: 0, mantenimiento: 80_000, relevo: false }];
  const r = calcularResumen({
    dias,
    parametros: PARAMETROS,
    buseta: { tieneCupo: false, valorArriendo: 1_500_000 },
  });
  assert.equal(r.arriendo, 1_500_000);
  assert.equal(r.reposicion, 70_000);
  assert.equal(r.fondoFijo, true);
  assert.equal(r.mantenimiento, 80_000);
  // 1.000.000 − 200.000 − 70.000 − 3.066.000 − 80.000 − 1.500.000
  assert.equal(r.neto, -3_916_000);
});

test('redondea al peso los porcentajes', () => {
  const dias = [{ ingreso: 333_333, peajes: 0, salidas: 0, acpm: 0, mantenimiento: 0, relevo: false }];
  const r = calcularResumen({ dias, parametros: PARAMETROS, buseta: CON_CUPO });
  assert.equal(r.empresa, 66_667); // 66.666,6
  assert.equal(r.reposicion, 3_333); // 3.333,33
});

test('un mes sin registros da bruto 0', () => {
  const r = calcularResumen({ dias: [], parametros: PARAMETROS, buseta: CON_CUPO });
  assert.equal(r.bruto, 0);
  assert.equal(r.diasTrabajados, 0);
});

// Planilla real de la buseta 2007 (octubre): sin cupo, arriendo 300.000, ACPM
// pagado por el conductor y ACPM a crédito en La Guaca (días 7, 9, 14, 17, 18).
// [día, producido, peajes, salidas, acpm conductor, acpm La Guaca]
const PLANILLA_2007 = [
  [1, 811000, 127200, 21300, 0, 0],
  [2, 793000, 127200, 21300, 130017, 0],
  [3, 888500, 127200, 21300, 160026, 0],
  [5, 1078000, 169600, 28400, 120000, 0],
  [7, 710500, 136400, 69500, 0, 79967],
  [8, 787000, 127200, 21300, 0, 0],
  [9, 886000, 127200, 21300, 0, 203688],
  [10, 575000, 84800, 14200, 85031, 0],
  [11, 593500, 89400, 38300, 0, 0],
  [14, 301500, 42400, 7100, 0, 79153],
  [15, 589000, 84800, 14200, 0, 0],
  [16, 856000, 136400, 69500, 129026, 0],
  [17, 796500, 127200, 21300, 0, 69832],
  [18, 840500, 127200, 21300, 0, 152866],
  [19, 1039500, 169600, 28400, 150000, 0],
].map(([, ingreso, peajes, salidas, acpm, acpmCredito]) => ({
  ingreso,
  peajes,
  salidas,
  acpm,
  acpmCredito,
  mantenimiento: 0,
  relevo: false,
}));

test('planilla real de la 2007: ACPM La Guaca, arriendo, fondo fijo y mantenimiento', () => {
  const r = calcularResumen({
    dias: PLANILLA_2007,
    parametros: PARAMETROS,
    buseta: { tieneCupo: false, valorArriendo: 300_000 },
    ajustes: [{ tipo: 'mantenimiento', valor: 1_000_000 }],
    mes: 10,
  });
  assert.equal(r.bruto, 11_545_500);
  assert.equal(r.empresa, 2_309_100);
  assert.equal(r.peajes, 1_803_800);
  assert.equal(r.salidas, 418_700);
  assert.equal(r.acpmConductor, 774_100); // "ACPM CARLOS" de la planilla
  assert.equal(r.acpmCredito, 585_506); // "GUACA"
  assert.equal(r.acpm, 1_359_606); // "ACPM TOTAL"
  assert.equal(r.reposicion, 70_000); // fondo fijo para busetas con arriendo
  assert.equal(r.arriendo, 300_000);
  assert.equal(r.mantenimiento, 1_000_000);
  // La planilla tenía el fondo en 65.000 ("Total bruto" 2.582.900, neto 1.223.294);
  // con el fondo fijo de 70.000 que se definió, ambos bajan 5.000.
  assert.equal(r.netoAntesAcpm, 2_582_900 - 5_000);
  assert.equal(r.neto, 1_223_294 - 5_000);
});

test('el seguro contractual solo se descuenta de febrero a julio', () => {
  const parametros = { ...PARAMETROS, seguro_contractual: '150000.0000' };
  const base = { dias: PLANILLA_2033, parametros, buseta: CON_CUPO };
  for (const mes of [2, 3, 4, 5, 6, 7]) {
    assert.equal(calcularResumen({ ...base, mes }).seguroContractual, 150_000, `mes ${mes}`);
  }
  for (const mes of [1, 8, 9, 10, 11, 12]) {
    assert.equal(calcularResumen({ ...base, mes }).seguroContractual, 0, `mes ${mes}`);
  }
  assert.equal(calcularResumen({ ...base, mes: 3 }).neto, 1_811_404 - 150_000);
});

test('sin valor de seguro contractual cargado, no descuenta nada', () => {
  const r = calcularResumen({ dias: PLANILLA_2033, parametros: PARAMETROS, buseta: CON_CUPO, mes: 3 });
  assert.equal(r.seguroContractual, 0);
  assert.equal(r.neto, 1_811_404);
});
