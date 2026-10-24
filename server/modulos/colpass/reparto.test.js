import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repartir } from './reparto.js';

const DIAS = [
  { fecha: '2026-10-01', peajes: 84800 },
  { fecha: '2026-10-02', peajes: 127200 },
  { fecha: '2026-10-03', peajes: 42400 },
];
const entrega = (id, valor) => ({ id, fecha: '2026-10-10', valor });

test('sin entregas todo está pendiente', () => {
  const r = repartir(DIAS, []);
  assert.deepEqual(r.pendiente, { total: 254400, dias: 3, desde: '2026-10-01', hasta: '2026-10-03' });
  assert.deepEqual(r.dias.map((d) => d.estado), ['pendiente', 'pendiente', 'pendiente']);
  assert.equal(r.saldoAFavor, 0);
});

test('una entrega cubre los días más viejos primero; el que no alcanza queda parcial', () => {
  const r = repartir(DIAS, [entrega(1, 100000)]);
  assert.deepEqual(
    r.dias.map((d) => [d.estado, d.cubierto]),
    [['liquidado', 84800], ['parcial', 15200], ['pendiente', 0]],
  );
  assert.deepEqual(r.pendiente, { total: 154400, dias: 2, desde: '2026-10-02', hasta: '2026-10-03' });
  assert.deepEqual(r.entregas[0].cubre, { desde: '2026-10-01', hasta: '2026-10-02' });
});

test('la siguiente entrega sigue desde donde quedó la anterior', () => {
  const r = repartir(DIAS, [entrega(1, 100000), entrega(2, 112000)]);
  assert.deepEqual(r.entregas[1].cubre, { desde: '2026-10-02', hasta: '2026-10-02' });
  assert.equal(r.dias[1].estado, 'liquidado');
  assert.equal(r.pendiente.total, 42400);
});

test('entregar todo deja la cuenta en cero', () => {
  const r = repartir(DIAS, [entrega(1, 254400)]);
  assert.deepEqual(r.pendiente, { total: 0, dias: 0, desde: null, hasta: null });
  assert.deepEqual(r.entregas[0].cubre, { desde: '2026-10-01', hasta: '2026-10-03' });
});

test('si después se bajan peajes en el producido, sobra: saldo a favor', () => {
  const r = repartir(DIAS.slice(0, 1), [entrega(1, 100000)]);
  assert.equal(r.saldoAFavor, 15200);
  assert.equal(r.pendiente.total, 0);
});
