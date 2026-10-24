import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cierreDeLiquidacion, netoDeLiquidacion, resumenDeCierre } from './liquidacion.js';

// Liquidación real de la cooperativa: microbús 2007, agosto de 2026.
const AGOSTO_2007 = {
  totalBruto: 10_427_500,
  administracion: 2_085_500,
  polizas: 0,
  fondoReposicion: 42_500,
  salidas: 425_800,
  combustibles: 0,
  peajes: 1_867_400,
  prestamos: 306_540,
  salarioConductor: 1_833_333,
  prestacionesConductor: 391_207,
  seguridadSocialConductor: 329_151,
  salarioRelevo: 0,
  prestacionesRelevo: 0,
  seguridadSocialRelevo: 0,
  vacacionesRelevo: 0,
};

test('el neto a pagar cuadra con el documento', () => {
  assert.equal(netoDeLiquidacion(AGOSTO_2007), 3_146_069);
});

test('de la liquidación al cierre: la nómina del conductor junta salario, prestaciones y seguridad social', () => {
  const cierre = cierreDeLiquidacion(AGOSTO_2007);
  assert.equal(cierre.conductor, 2_553_691);
  assert.equal(cierre.empresa, 2_085_500);
  assert.equal(cierre.reposicion, 42_500);
  assert.equal(cierre.prestamos, 306_540);
  assert.equal(cierre.relevo, 0);
  assert.equal(cierre.neto, 3_146_069);
});

test('del cierre al resumen: misma forma que calcularResumen y los costos cuadran', () => {
  const r = resumenDeCierre({ ...cierreDeLiquidacion(AGOSTO_2007), origen: 'liquidacion' });
  assert.equal(r.bruto, 10_427_500);
  assert.equal(r.bruto - r.costos, r.neto);
  assert.equal(r.neto, 3_146_069);
  assert.equal(r.netoAntesAcpm, 3_146_069); // sin combustible en la liquidación
  assert.equal(r.diasTrabajados, 0);
  assert.equal(r.deLiquidacion, true);
});
