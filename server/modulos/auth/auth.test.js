import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import { DURACION_SESION_SEG, firmarToken } from '../../compartido/seguridad/sesion.js';
import { cookieDe, crearBdPrueba, crearUsuario, iniciarServidor } from '../../compartido/test/helpers.js';

let db;
let servidor;
let pedro;

before(async () => {
  db = await crearBdPrueba();
  await db.exec(`INSERT INTO buseta (numero_interno, placa) VALUES ('101', 'ABC123')`);
  await crearUsuario(db, { usuario: 'Admin' });
  pedro = await crearUsuario(db, { usuario: 'pedro', rol: 'conductor', busetaId: 1 });
  await crearUsuario(db, { usuario: 'inactivo', rol: 'conductor', activo: false });
  servidor = await iniciarServidor(crearApp({ db }));
});

after(() => servidor.cerrar());

const login = (usuario, password) => servidor.pedir('POST', '/api/auth/login', null, { usuario, password });
const yo = (cookie) => servidor.pedir('GET', '/api/auth/yo', cookie);

test('login correcto devuelve el usuario y una cookie segura', async () => {
  const { status, cuerpo, res } = await login('pedro', 'clave-correcta');
  assert.equal(status, 200);
  assert.deepEqual(cuerpo, {
    usuario: {
      id: pedro.id,
      usuario: 'pedro',
      nombre: 'Nombre pedro',
      rol: 'conductor',
      busetaId: 1,
      debeCambiarPassword: false,
    },
  });

  const setCookie = res.headers.getSetCookie()[0];
  assert.match(setCookie, /^sesion=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, new RegExp(`Max-Age=${DURACION_SESION_SEG}`));
});

test('el usuario no distingue mayúsculas', async () => {
  const { status, cuerpo } = await login('  ADMIN ', 'clave-correcta');
  assert.equal(status, 200);
  assert.equal(cuerpo.usuario.rol, 'admin');
});

test('contraseña incorrecta y usuario inexistente dan el mismo error', async () => {
  for (const [usuario, password] of [['pedro', 'mala'], ['nadie', 'clave-correcta']]) {
    const { status, cuerpo, res } = await login(usuario, password);
    assert.equal(status, 401);
    assert.deepEqual(cuerpo, { error: 'Usuario o contraseña incorrectos' });
    assert.equal(cookieDe(res), null);
  }
});

test('usuario inactivo no puede entrar', async () => {
  assert.equal((await login('inactivo', 'clave-correcta')).status, 401);
});

test('login sin datos devuelve 400', async () => {
  assert.equal((await login('', '')).status, 400);
});

test('/yo sin cookie devuelve 401', async () => {
  assert.equal((await yo()).status, 401);
});

test('/yo con sesión devuelve el usuario y renueva la cookie', async () => {
  const cookie = cookieDe((await login('pedro', 'clave-correcta')).res);
  const { status, cuerpo, res } = await yo(cookie);
  assert.equal(status, 200);
  assert.equal(cuerpo.usuario.usuario, 'pedro');
  assert.ok(cookieDe(res), 'debe renovar la cookie');
});

test('token alterado devuelve 401 y borra la cookie', async () => {
  const cookie = cookieDe((await login('pedro', 'clave-correcta')).res);
  const { status, res } = await yo(cookie.slice(0, -3) + 'xyz');
  assert.equal(status, 401);
  assert.match(res.headers.getSetCookie()[0], /Expires=Thu, 01 Jan 1970/);
});

test('token vencido por inactividad devuelve 401', async () => {
  const hace31Min = Math.floor(Date.now() / 1000) - 31 * 60;
  assert.equal((await yo(`sesion=${await firmarToken(pedro.id, 0, hace31Min)}`)).status, 401);
});

test('desactivar al usuario corta su sesión de inmediato', async () => {
  const cookie = cookieDe((await login('pedro', 'clave-correcta')).res);
  await db.query(`UPDATE usuario SET activo = false WHERE usuario = 'pedro'`);
  try {
    assert.equal((await yo(cookie)).status, 401);
  } finally {
    await db.query(`UPDATE usuario SET activo = true WHERE usuario = 'pedro'`);
  }
});

test('5 intentos fallidos bloquean el usuario aunque luego acierte', async () => {
  await crearUsuario(db, { usuario: 'victima' });
  for (let i = 0; i < 5; i++) assert.equal((await login('victima', 'mala')).status, 401);

  const { status, cuerpo } = await login('VICTIMA', 'clave-correcta');
  assert.equal(status, 429);
  assert.match(cuerpo.error, /Demasiados intentos fallidos\. Intenta de nuevo en 5 minutos\./);

  // Otros usuarios no se ven afectados.
  assert.equal((await login('pedro', 'clave-correcta')).status, 200);
});

test('el bloqueo dice cuántos minutos faltan y se levanta al salir de la ventana', async () => {
  await crearUsuario(db, { usuario: 'paciente' });
  for (let i = 0; i < 5; i++) await login('paciente', 'mala');

  await db.query(`UPDATE intento_login SET creado_en = now() - interval '2 minutes' WHERE usuario = 'paciente'`);
  assert.match((await login('paciente', 'clave-correcta')).cuerpo.error, /en 3 minutos\./);

  await db.query(`UPDATE intento_login SET creado_en = now() - interval '4 minutes 30 seconds' WHERE usuario = 'paciente'`);
  assert.match((await login('paciente', 'clave-correcta')).cuerpo.error, /en 1 minuto\./);

  await db.query(`UPDATE intento_login SET creado_en = now() - interval '6 minutes' WHERE usuario = 'paciente'`);
  assert.equal((await login('paciente', 'clave-correcta')).status, 200);
});

test('login exitoso reinicia el contador de fallos', async () => {
  for (let i = 0; i < 4; i++) await login('Admin', 'mala');
  assert.equal((await login('Admin', 'clave-correcta')).status, 200);
  assert.equal((await login('Admin', 'mala')).status, 401); // no 429
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM intento_login WHERE lower(usuario) = 'admin'`);
  assert.equal(rows[0].n, 1);
});

test('logout borra la cookie', async () => {
  const { status, res } = await servidor.pedir('POST', '/api/auth/logout');
  assert.equal(status, 204);
  assert.match(res.headers.getSetCookie()[0], /^sesion=;/);
});
