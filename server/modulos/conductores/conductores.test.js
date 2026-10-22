import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import { crearBdPrueba, crearUsuario, iniciarServidor } from '../../compartido/test/helpers.js';

let servidor;
let admin;

before(async () => {
  const db = await crearBdPrueba();
  await db.exec(`
    INSERT INTO buseta (numero_interno, placa) VALUES ('101', 'ABC123');
    INSERT INTO buseta (numero_interno, placa, activo) VALUES ('102', 'INA000', false);
  `);
  admin = await crearUsuario(db, { usuario: 'admin' });
  servidor = await iniciarServidor(crearApp({ db }));
});

after(() => servidor.cerrar());

const pedir = (metodo, ruta, cookie, cuerpo) => servidor.pedir(metodo, `/api/conductores${ruta}`, cookie, cuerpo);
const login = (usuario, password) => servidor.pedir('POST', '/api/auth/login', null, { usuario, password });

let conductor;
let password;

test('crear devuelve la contraseña una vez y con ella se puede entrar', async () => {
  const { status, cuerpo } = await pedir('POST', '', admin.cookie, {
    usuario: ' Carlos.R ', nombre: 'Carlos Ruiz', cedula: '1.088.123.456', telefono: '310 555 1234', busetaId: null,
  });
  assert.equal(status, 201);
  ({ conductor, password } = cuerpo);
  assert.equal(conductor.usuario, 'carlos.r');
  assert.equal(conductor.cedula, '1088123456');
  assert.equal(conductor.telefono, '3105551234');
  assert.match(password, /^[a-z2-9]{10}$/);
  assert.equal(JSON.stringify(cuerpo).includes('hash'), false);

  const entrar = await login('carlos.r', password);
  assert.equal(entrar.status, 200);
  assert.equal(entrar.cuerpo.usuario.rol, 'conductor');
});

test('el conductor no puede usar el módulo', async () => {
  const sesion = await login('carlos.r', password);
  const cookie = sesion.res.headers.getSetCookie()[0].split(';')[0];
  assert.equal((await pedir('GET', '', cookie)).status, 403);
});

test('usuario duplicado → 409', async () => {
  const { status, cuerpo } = await pedir('POST', '', admin.cookie, { usuario: 'CARLOS.R', nombre: 'Otro' });
  assert.equal(status, 409);
  assert.ok(cuerpo.campos.usuario);
});

test('no se puede asignar una buseta inactiva o inexistente', async () => {
  for (const busetaId of [2, 999]) {
    const { status, cuerpo } = await pedir('PUT', `/${conductor.id}`, admin.cookie, { ...conductor, busetaId });
    assert.equal(status, 400);
    assert.ok(cuerpo.campos.busetaId);
  }
});

test('asignar buseta y no repetirla en otro conductor', async () => {
  const asignar = await pedir('PUT', `/${conductor.id}`, admin.cookie, { ...conductor, busetaId: 1 });
  assert.equal(asignar.status, 200);
  assert.equal(asignar.cuerpo.conductor.busetaPlaca, 'ABC123');

  const otro = await pedir('POST', '', admin.cookie, { usuario: 'otro', nombre: 'Otro', busetaId: 1 });
  assert.equal(otro.status, 409);
  assert.match(otro.cuerpo.campos.busetaId, /otro conductor/);
});

test('restablecer contraseña invalida la anterior', async () => {
  const { status, cuerpo } = await pedir('POST', `/${conductor.id}/restablecer-password`, admin.cookie);
  assert.equal(status, 200);
  assert.notEqual(cuerpo.password, password);
  assert.equal((await login('carlos.r', password)).status, 401);
  assert.equal((await login('carlos.r', cuerpo.password)).status, 200);
  password = cuerpo.password;
});

test('desactivar impide entrar', async () => {
  const { cuerpo } = await pedir('GET', `/${conductor.id}`, admin.cookie);
  const r = await pedir('PUT', `/${conductor.id}`, admin.cookie, { ...cuerpo.conductor, activo: false });
  assert.equal(r.status, 200);
  assert.equal((await login('carlos.r', password)).status, 401);
});

test('id inexistente → 404', async () => {
  assert.equal((await pedir('GET', '/9999', admin.cookie)).status, 404);
  assert.equal((await pedir('POST', '/9999/restablecer-password', admin.cookie)).status, 404);
});
