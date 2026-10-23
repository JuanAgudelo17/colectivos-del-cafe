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

test('sin cupo descuenta el arriendo; el mantenimiento se suma', () => {
  const dias = [{ ingreso: 1_000_000, peajes: 0, salidas: 0, acpm: 0, mantenimiento: 80_000, relevo: false }];
  const r = calcularResumen({
    dias,
    parametros: PARAMETROS,
    buseta: { tieneCupo: false, valorArriendo: 1_500_000 },
  });
  assert.equal(r.arriendo, 1_500_000);
  assert.equal(r.mantenimiento, 80_000);
  // 1.000.000 − 200.000 − 10.000 − 3.066.000 − 80.000 − 1.500.000
  assert.equal(r.neto, -3_856_000);
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
