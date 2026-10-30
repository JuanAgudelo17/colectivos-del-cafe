import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conciliar } from './conciliacion.js';

const planilla = {
  bruto: 10427500,
  empresa: 2085500,
  reposicion: 70000,
  conductor: 3066000,
  relevo: 0,
  peajes: 1867400,
  salidas: 425800,
  acpm: 585506,
  seguroContractual: 0,
  prestamos: 306540,
  mantenimiento: 120000,
  arriendo: 300000,
  bono: 0,
  neto: 1600754,
};

// Liquidación real de la 2007, agosto de 2026.
const cooperativa = {
  totalBruto: 10427500,
  administracion: 2085500,
  polizas: 0,
  fondoReposicion: 42500,
  salidas: 425800,
  combustibles: 0,
  peajes: 1867400,
  prestamos: 306540,
  salarioConductor: 1833333,
  prestacionesConductor: 391207,
  seguridadSocialConductor: 329151,
  salarioRelevo: 0,
  prestacionesRelevo: 0,
  seguridadSocialRelevo: 0,
  vacacionesRelevo: 0,
  netoAPagar: 3146069,
};

test('compara línea por línea: diferencia = cooperativa − planilla', () => {
  const { lineas, neto, cuadra } = conciliar(planilla, cooperativa);
  const de = (clave) => lineas.find((l) => l.clave === clave);

  assert.equal(de('bruto').diferencia, 0);
  assert.equal(de('empresa').diferencia, 0);
  assert.equal(de('reposicion').diferencia, -27500);
  assert.equal(de('conductor').cooperativa, 2553691);
  assert.equal(de('conductor').diferencia, -512309);
  assert.equal(de('acpm').diferencia, -585506);
  assert.equal(de('mantenimiento').nota, 'La cooperativa no lo descuenta');
  assert.equal(de('arriendo').diferencia, -300000);
  assert.deepEqual(neto, { planilla: 1600754, cooperativa: 3146069, diferencia: 1545315 });
  assert.equal(cuadra, false);
});

test('no muestra lo que está en cero en los dos lados', () => {
  const claves = conciliar(planilla, cooperativa).lineas.map((l) => l.clave);
  assert.ok(!claves.includes('relevo'));
  assert.ok(!claves.includes('polizas'));
  assert.ok(!claves.includes('bono'));
});

test('el neto se explica con las diferencias de las líneas', () => {
  const { lineas, neto } = conciliar(planilla, cooperativa);
  const deDescuentos = lineas.filter((l) => l.clave !== 'bruto').reduce((t, l) => t + l.diferencia, 0);
  const deBruto = lineas.find((l) => l.clave === 'bruto').diferencia;
  assert.equal(neto.diferencia, deBruto - deDescuentos);
});

test('cuadra si todo coincide', () => {
  const igual = { ...planilla, reposicion: 42500, conductor: 2553691, acpm: 0, mantenimiento: 0, arriendo: 0, neto: 3146069 };
  assert.equal(conciliar(igual, cooperativa).cuadra, true);
  assert.equal(conciliar(igual, cooperativa).neto.diferencia, 0);
});
