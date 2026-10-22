import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { crearManejadorErrores } from '../../app.js';
import { crearBdPrueba, crearUsuario, iniciarServidor } from '../test/helpers.js';
import { alcance, autenticar, requiereRol } from './middleware.js';

test('alcance: admin sin restricción, conductor solo lo suyo', () => {
  assert.deepEqual(alcance({ id: 1, rol: 'admin', busetaId: null }), { busetaId: null, conductorId: null });
  assert.deepEqual(alcance({ id: 3, rol: 'conductor', busetaId: 7 }), { busetaId: 7, conductorId: 3 });
});

let servidor;
let admin;
let conductor;

before(async () => {
  const db = await crearBdPrueba();
  admin = await crearUsuario(db, { usuario: 'admin' });
  conductor = await crearUsuario(db, { usuario: 'conductor', rol: 'conductor' });

  const app = express();
  app.locals.db = db;
  app.get('/solo-admin', autenticar, requiereRol('admin'), (req, res) => res.json({ ok: true }));
  app.use(crearManejadorErrores());
  servidor = await iniciarServidor(app);
});

after(() => servidor.cerrar());

test('requiereRol: sin sesión 401, conductor 403, admin 200', async () => {
  assert.equal((await servidor.pedir('GET', '/solo-admin')).status, 401);
  assert.equal((await servidor.pedir('GET', '/solo-admin', conductor.cookie)).status, 403);
  assert.equal((await servidor.pedir('GET', '/solo-admin', admin.cookie)).status, 200);
});
