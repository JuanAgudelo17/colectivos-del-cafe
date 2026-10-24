import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proyectarMes } from './proyeccion.js';

// Mes en curso al día 10 de 30: el producido y lo que depende de él se triplica;
// lo fijo (sueldo, arriendo, mantenimiento…) queda igual.
const RESUMEN = {
  bruto: 4_000_000,
  empresa: 800_000,
  reposicion: 40_000,
  conductor: 3_066_000,
  peajes: 500_000,
  salidas: 100_000,
  acpm: 600_000,
  relevo: 0,
  arriendo: 0,
  seguroContractual: 0,
  mantenimiento: 200_000,
  bono: 0,
  prestamos: 0,
};

test('con cupo: escala lo variable (incluido el 1 %) y deja lo fijo', () => {
  const p = proyectarMes(RESUMEN, { diasDelMes: 30, diaDeHoy: 10, tieneCupo: true });
  assert.equal(p.bruto, 12_000_000);
  // variables (800+40+500+100+600 mil) × 3 + fijos (3.066.000 + 200.000)
  assert.equal(p.costos, 2_040_000 * 3 + 3_266_000);
  assert.equal(p.neto, 12_000_000 - p.costos);
  assert.deepEqual([p.diasTranscurridos, p.diasDelMes], [10, 30]);
});

test('sin cupo: el fondo fijo y el arriendo no se escalan', () => {
  const sinCupo = { ...RESUMEN, reposicion: 70_000, arriendo: 300_000 };
  const p = proyectarMes(sinCupo, { diasDelMes: 30, diaDeHoy: 10, tieneCupo: false });
  assert.equal(p.costos, 2_000_000 * 3 + 3_066_000 + 300_000 + 70_000 + 200_000);
});

test('muy temprano en el mes, o el último día, no hay proyección', () => {
  assert.equal(proyectarMes(RESUMEN, { diasDelMes: 31, diaDeHoy: 4, tieneCupo: true }), null);
  assert.equal(proyectarMes(RESUMEN, { diasDelMes: 31, diaDeHoy: 31, tieneCupo: true }), null);
});
