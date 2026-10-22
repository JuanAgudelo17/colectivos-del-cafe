import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../app.js';
import { iniciarServidor } from './helpers.js';

let servidor;

// /api/salud no toca la base de datos.
before(async () => {
  servidor = await iniciarServidor(crearApp({ db: null }));
});

after(() => servidor.cerrar());

test('GET /api/salud responde ok', async () => {
  const res = await fetch(`${servidor.base}/api/salud`);
  assert.equal(res.status, 200);
  const cuerpo = await res.json();
  assert.equal(cuerpo.ok, true);
  assert.match(cuerpo.hora, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test('también responde en la ruta directa de la función', async () => {
  const res = await fetch(`${servidor.base}/.netlify/functions/api/salud`);
  assert.equal(res.status, 200);
});

test('ruta inexistente devuelve 404 en JSON', async () => {
  const res = await fetch(`${servidor.base}/api/no-existe`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Ruta no encontrada' });
});

test('JSON mal formado devuelve 400 sin detalles internos', async () => {
  const res = await fetch(`${servidor.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{malo',
  });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'Solicitud inválida' });
});
