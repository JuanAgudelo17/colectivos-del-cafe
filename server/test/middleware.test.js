import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { manejarErrores } from '../app.js';
import { autenticar, requiereRol } from '../middleware/auth.js';
import { alcance, puedeAccederEmpresa, requiereEmpresa } from '../middleware/empresa.js';
import { firmarToken } from '../lib/sesion.js';
import { crearBdPrueba, hashPrueba, iniciarServidor } from './helpers.js';

const adminGlobal = { id: 1, rol: 'admin', empresaId: null, busetaId: null };
const adminEmpresa1 = { id: 2, rol: 'admin', empresaId: 1, busetaId: null };
const conductor = { id: 3, rol: 'conductor', empresaId: 1, busetaId: 7 };

test('puedeAccederEmpresa', () => {
  assert.equal(puedeAccederEmpresa(adminGlobal, 1), true);
  assert.equal(puedeAccederEmpresa(adminGlobal, 99), true);
  assert.equal(puedeAccederEmpresa(adminEmpresa1, 1), true);
  assert.equal(puedeAccederEmpresa(adminEmpresa1, 2), false);
  assert.equal(puedeAccederEmpresa(conductor, '1'), true);
  assert.equal(puedeAccederEmpresa(conductor, 2), false);
  // Un conductor mal configurado sin empresa no accede a nada.
  assert.equal(puedeAccederEmpresa({ ...conductor, empresaId: null }, 1), false);
});

test('alcance restringe al conductor a lo suyo', () => {
  assert.deepEqual(alcance(adminGlobal), { empresaId: null, busetaId: null, conductorId: null });
  assert.deepEqual(alcance(conductor), { empresaId: 1, busetaId: 7, conductorId: 3 });
});

// Rutas de prueba que combinan los middlewares como lo harán las rutas reales.
let servidor;
let cookies;

before(async () => {
  const db = await crearBdPrueba();
  const hash = await hashPrueba('x');
  await db.exec(`INSERT INTO empresa (nombre) VALUES ('Empresa 2')`);
  await db.query(
    `INSERT INTO usuario (empresa_id, usuario, nombre, password_hash, rol) VALUES
       (NULL, 'admin', 'Admin', $1, 'admin'),
       (1, 'conductor', 'Conductor', $1, 'conductor')`,
    [hash],
  );

  const app = express();
  app.locals.db = db;
  app.get('/prueba/solo-admin', autenticar, requiereRol('admin'), (req, res) => res.json({ ok: true }));
  app.get('/prueba/empresas/:empresaId', autenticar, requiereEmpresa(), (req, res) => res.json({ ok: true }));
  app.use(manejarErrores);

  servidor = await iniciarServidor(app);
  cookies = {
    admin: `sesion=${await firmarToken(1)}`,
    conductor: `sesion=${await firmarToken(2)}`,
  };
});

after(() => servidor.cerrar());

const pedir = (ruta, quien) =>
  fetch(`${servidor.base}${ruta}`, { headers: quien ? { Cookie: cookies[quien] } : {} });

test('requiereRol: sin sesión 401, conductor 403, admin 200', async () => {
  assert.equal((await pedir('/prueba/solo-admin')).status, 401);
  assert.equal((await pedir('/prueba/solo-admin', 'conductor')).status, 403);
  assert.equal((await pedir('/prueba/solo-admin', 'admin')).status, 200);
});

test('requiereEmpresa: conductor solo su empresa, admin global todas', async () => {
  assert.equal((await pedir('/prueba/empresas/1', 'conductor')).status, 200);
  assert.equal((await pedir('/prueba/empresas/2', 'conductor')).status, 403);
  assert.equal((await pedir('/prueba/empresas/abc', 'conductor')).status, 403);
  assert.equal((await pedir('/prueba/empresas/2', 'admin')).status, 200);
});
