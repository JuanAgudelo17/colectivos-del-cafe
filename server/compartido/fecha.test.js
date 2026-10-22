import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ahoraBogota, mesActualBogota } from './fecha.js';

test('ahoraBogota convierte UTC a hora de Bogotá (UTC-5)', () => {
  const fecha = new Date('2026-03-01T03:30:00Z');
  assert.equal(ahoraBogota(fecha), '2026-02-28 22:30:00');
});

test('mesActualBogota usa el mes de Bogotá, no el de UTC', () => {
  // 1 de marzo en UTC, pero todavía 28 de febrero en Bogotá
  const fecha = new Date('2026-03-01T03:30:00Z');
  assert.deepEqual(mesActualBogota(fecha), { anio: 2026, mes: 2 });
});
