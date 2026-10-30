import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Router } from 'express';
import { crearApp } from '../../app.js';
import { modulos } from '../index.js';
import { crearBdPrueba, crearUsuario, iniciarServidor } from '../../compartido/test/helpers.js';
import { huellaDe, registrarError } from './registrar.js';

let db;
let servidor;
let admin;
let carlos;
const enviados = [];

// Un módulo de prueba que falla, para ver que los 500 quedan registrados.
const falla = Router();
falla.get('/:id', () => {
  throw new Error('Se rompió la consulta 4521');
});
falla.get('/', () => {
  const error = new Error('Esto es del usuario');
  error.status = 400;
  throw error;
});

before(async () => {
  db = await crearBdPrueba();
  admin = await crearUsuario(db, { usuario: 'admin' });
  carlos = await crearUsuario(db, { usuario: 'carlos', rol: 'conductor' });
  await db.query(`INSERT INTO suscripcion_push (usuario_id, endpoint, p256dh, auth) VALUES ($1, 'https://push.test/a', 'p', 'a')`, [admin.id]);
  const app = crearApp({ db, modulos: [...modulos, { ruta: '/falla', router: falla, restricciones: {} }] });
  // Enviador de push falso: anota lo que se mandaría al celular.
  app.locals.enviador = {
    configurado: true,
    clavePublica: 'x',
    enviar: async (s, datos) => (enviados.push(datos), 'enviada'),
  };
  servidor = await iniciarServidor(app);
});

after(() => servidor.cerrar());

const pedir = (metodo, ruta, quien, cuerpo) => servidor.pedir(metodo, `/api/errores${ruta}`, quien?.cookie, cuerpo);
const avisosDe = async (usuario) =>
  (await db.query(`SELECT titulo, cuerpo, url FROM notificacion WHERE usuario_id = $1 AND tipo = 'error'`, [usuario.id])).rows;

test('la huella ignora los números (ids, valores)', () => {
  const a = huellaDe({ origen: 'servidor', ruta: 'GET /x', mensaje: 'Falló la buseta 2033' });
  const b = huellaDe({ origen: 'servidor', ruta: 'GET /x', mensaje: 'Falló la buseta 2007' });
  const c = huellaDe({ origen: 'navegador', ruta: 'GET /x', mensaje: 'Falló la buseta 2007' });
  assert.equal(a, b);
  assert.notEqual(b, c);
});

test('un 500 del servidor queda registrado y se avisa a los admin', async () => {
  const r = await servidor.pedir('GET', '/api/falla/77', carlos.cookie);
  assert.equal(r.status, 500);
  assert.equal(r.cuerpo.error, 'Error interno del servidor');

  const { cuerpo } = await pedir('GET', '', admin);
  assert.equal(cuerpo.pendientes, 1);
  const [error] = cuerpo.errores;
  assert.equal(error.origen, 'servidor');
  assert.equal(error.mensaje, 'Se rompió la consulta 4521');
  assert.equal(error.ruta, 'GET /api/falla/:id');
  assert.match(error.detalle, /Error: Se rompió/);

  const avisos = await avisosDe(admin);
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].url, '/admin/errores');
  assert.equal((await avisosDe(carlos)).length, 0, 'al conductor no le llega');
  assert.equal(enviados.length, 1);
});

test('el mismo error se cuenta y no repite el aviso el mismo día', async () => {
  await servidor.pedir('GET', '/api/falla/99', null);
  const { cuerpo } = await pedir('GET', '', admin);
  assert.equal(cuerpo.errores.length, 1);
  assert.equal(cuerpo.errores[0].veces, 2);
  assert.equal((await avisosDe(admin)).length, 1);
});

test('los errores 4xx no se registran', async () => {
  assert.equal((await servidor.pedir('GET', '/api/falla', null)).status, 400);
  assert.equal((await pedir('GET', '', admin)).cuerpo.errores.length, 1);
});

test('el navegador reporta errores sin sesión; se valida lo que manda', async () => {
  assert.equal((await pedir('POST', '', null, { mensaje: '' })).status, 400);
  const r = await pedir('POST', '', null, { mensaje: 'TypeError: x is undefined', detalle: 'at Mes (index.js:1:2)', ruta: '/conductor/mi-producido' });
  assert.equal(r.status, 204);
  await pedir('POST', '', carlos, { mensaje: 'TypeError: x is undefined', ruta: '/conductor/mi-producido' });

  const { cuerpo } = await pedir('GET', '', admin);
  const delNavegador = cuerpo.errores.find((e) => e.origen === 'navegador');
  assert.equal(delNavegador.veces, 2);
  assert.equal(delNavegador.usuario, 'Nombre carlos');
  assert.equal(cuerpo.pendientes, 2);
});

test('solo el admin ve los errores y los marca resueltos; si vuelve a pasar, se reabre', async () => {
  assert.equal((await pedir('GET', '', carlos)).status, 403);
  assert.equal((await pedir('GET', '', null)).status, 401);

  const { cuerpo } = await pedir('GET', '', admin);
  const id = cuerpo.errores.find((e) => e.origen === 'servidor').id;
  assert.equal((await pedir('POST', `/${id}/resuelto`, carlos)).status, 403);
  const r = await pedir('POST', `/${id}/resuelto`, admin);
  assert.equal(r.cuerpo.pendientes, 1);
  assert.equal((await pedir('POST', `/${id}/resuelto`, admin)).status, 404);

  const resueltos = await pedir('GET', '?resueltos=1', admin);
  assert.equal(resueltos.cuerpo.errores[0].id, id);

  await servidor.pedir('GET', '/api/falla/1', null);
  assert.equal((await pedir('GET', '', admin)).cuerpo.pendientes, 2);
});

test('registrarError nunca lanza (ej. con la base caída)', async () => {
  const caida = { query: async () => Promise.reject(new Error('sin conexión')) };
  assert.equal(await registrarError(caida, { origen: 'programada', mensaje: 'x' }), null);
});
