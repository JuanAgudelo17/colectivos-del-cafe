import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../app.js';
import { DURACION_SESION_SEG, firmarToken } from '../lib/sesion.js';
import { cookieDe, crearBdPrueba, hashPrueba, iniciarServidor } from './helpers.js';

let db;
let servidor;

before(async () => {
  db = await crearBdPrueba();
  const hash = await hashPrueba('clave-correcta');
  await db.exec(`
    INSERT INTO buseta (empresa_id, numero_interno, placa) VALUES (1, '101', 'ABC123');
    INSERT INTO empresa (nombre, activo) VALUES ('Empresa inactiva', false);
  `);
  await db.query(
    `INSERT INTO usuario (empresa_id, usuario, nombre, password_hash, rol, buseta_id, activo) VALUES
       (NULL, 'Admin',     'Admin Global', $1, 'admin',     NULL, true),
       (1,    'pedro',     'Pedro Pérez',  $1, 'conductor', 1,    true),
       (1,    'inactivo',  'Inactivo',     $1, 'conductor', NULL, false),
       (2,    'sinempresa','Sin Empresa',  $1, 'conductor', NULL, true)`,
    [hash],
  );
  servidor = await iniciarServidor(crearApp({ db }));
});

after(() => servidor.cerrar());

function login(usuario, password) {
  return fetch(`${servidor.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, password }),
  });
}

function yo(cookie) {
  return fetch(`${servidor.base}/api/auth/yo`, { headers: cookie ? { Cookie: cookie } : {} });
}

test('login correcto devuelve el usuario y una cookie segura', async () => {
  const res = await login('pedro', 'clave-correcta');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    usuario: { id: 2, usuario: 'pedro', nombre: 'Pedro Pérez', rol: 'conductor', empresaId: 1, busetaId: 1 },
  });

  const setCookie = res.headers.getSetCookie()[0];
  assert.match(setCookie, /^sesion=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, new RegExp(`Max-Age=${DURACION_SESION_SEG}`));
});

test('el usuario no distingue mayúsculas', async () => {
  const res = await login('  ADMIN ', 'clave-correcta');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).usuario.rol, 'admin');
});

test('contraseña incorrecta y usuario inexistente dan el mismo error', async () => {
  for (const [usuario, password] of [['pedro', 'mala'], ['nadie', 'clave-correcta']]) {
    const res = await login(usuario, password);
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: 'Usuario o contraseña incorrectos' });
    assert.equal(cookieDe(res), null);
  }
});

test('usuario inactivo o de empresa inactiva no puede entrar', async () => {
  assert.equal((await login('inactivo', 'clave-correcta')).status, 401);
  assert.equal((await login('sinempresa', 'clave-correcta')).status, 401);
});

test('login sin datos devuelve 400', async () => {
  const res = await login('', '');
  assert.equal(res.status, 400);
});

test('/yo sin cookie devuelve 401', async () => {
  const res = await yo();
  assert.equal(res.status, 401);
});

test('/yo con sesión devuelve el usuario y renueva la cookie', async () => {
  const cookie = cookieDe(await login('pedro', 'clave-correcta'));
  const res = await yo(cookie);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).usuario.usuario, 'pedro');
  assert.ok(cookieDe(res), 'debe renovar la cookie');
});

test('token alterado devuelve 401 y borra la cookie', async () => {
  const cookie = cookieDe(await login('pedro', 'clave-correcta'));
  const res = await yo(cookie.slice(0, -3) + 'xyz');
  assert.equal(res.status, 401);
  assert.match(res.headers.getSetCookie()[0], /Expires=Thu, 01 Jan 1970/);
});

test('token vencido por inactividad devuelve 401', async () => {
  const hace31Min = Math.floor(Date.now() / 1000) - 31 * 60;
  const res = await yo(`sesion=${await firmarToken(2, hace31Min)}`);
  assert.equal(res.status, 401);
});

test('desactivar al usuario corta su sesión de inmediato', async () => {
  const cookie = cookieDe(await login('pedro', 'clave-correcta'));
  await db.query(`UPDATE usuario SET activo = false WHERE usuario = 'pedro'`);
  try {
    assert.equal((await yo(cookie)).status, 401);
  } finally {
    await db.query(`UPDATE usuario SET activo = true WHERE usuario = 'pedro'`);
  }
});

test('logout borra la cookie', async () => {
  const res = await fetch(`${servidor.base}/api/auth/logout`, { method: 'POST' });
  assert.equal(res.status, 204);
  assert.match(res.headers.getSetCookie()[0], /^sesion=;/);
});
