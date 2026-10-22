import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import { crearBdPrueba, iniciarServidor } from '../../compartido/test/helpers.js';

let servidor;

before(async () => {
  servidor = await iniciarServidor(crearApp({ db: await crearBdPrueba() }));
});

after(() => servidor.cerrar());

test('GET /api/salud responde ok con JWT y base de datos bien configurados', async () => {
  const res = await fetch(`${servidor.base}/api/salud`);
  assert.equal(res.status, 200);
  const cuerpo = await res.json();
  assert.equal(cuerpo.ok, true);
  assert.equal(cuerpo.jwt, 'ok');
  assert.equal(cuerpo.baseDatos, 'ok');
  assert.match(cuerpo.hora, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test('GET /api/salud avisa si la base de datos falla, sin detalles', async () => {
  const fallo = Object.assign(new Error('password authentication failed for user postgres'), { code: '28P01' });
  const dbRota = { query: () => Promise.reject(fallo) };
  const otro = await iniciarServidor(crearApp({ db: dbRota }));
  try {
    const cuerpo = await (await fetch(`${otro.base}/api/salud`)).json();
    assert.equal(cuerpo.ok, false);
    assert.match(cuerpo.baseDatos, /error de conexión: 28P01/);
    assert.equal(JSON.stringify(cuerpo).includes('password'), false);
  } finally {
    await otro.cerrar();
  }
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
