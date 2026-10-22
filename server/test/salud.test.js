import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../app.js';

let servidor;
let base;

before(async () => {
  servidor = app.listen(0);
  await new Promise((resolve) => servidor.once('listening', resolve));
  base = `http://localhost:${servidor.address().port}`;
});

after(() => servidor.close());

test('GET /api/salud responde ok', async () => {
  const res = await fetch(`${base}/api/salud`);
  assert.equal(res.status, 200);
  const cuerpo = await res.json();
  assert.equal(cuerpo.ok, true);
  assert.match(cuerpo.hora, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test('también responde en la ruta directa de la función', async () => {
  const res = await fetch(`${base}/.netlify/functions/api/salud`);
  assert.equal(res.status, 200);
});

test('ruta inexistente devuelve 404 en JSON', async () => {
  const res = await fetch(`${base}/api/no-existe`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Ruta no encontrada' });
});
