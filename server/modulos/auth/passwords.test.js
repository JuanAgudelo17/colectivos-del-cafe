// Contraseñas propias: cambio, contraseña temporal obligatoria y recuperación.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import { cookieDe, crearBdPrueba, crearUsuario, iniciarServidor } from '../../compartido/test/helpers.js';

let db;
let servidor;
let admin;

before(async () => {
  db = await crearBdPrueba();
  admin = await crearUsuario(db, { usuario: 'admin' });
  servidor = await iniciarServidor(crearApp({ db }));
});

after(() => servidor.cerrar());

const login = (usuario, password) => servidor.pedir('POST', '/api/auth/login', null, { usuario, password });
const cambiar = (cookie, actual, nueva) => servidor.pedir('POST', '/api/auth/cambiar-password', cookie, { actual, nueva });
const sesionDe = async (usuario, password) => cookieDe((await login(usuario, password)).res);

describe('cambiar contraseña', () => {
  before(() => crearUsuario(db, { usuario: 'ana', rol: 'conductor' }));

  test('rechaza contraseña actual incorrecta', async () => {
    const cookie = await sesionDe('ana', 'clave-correcta');
    const { status, cuerpo } = await cambiar(cookie, 'mala', 'Nueva2026x');
    assert.equal(status, 400);
    assert.ok(cuerpo.campos.actual);
  });

  test('exige mínimo 8 caracteres con letra y número', async () => {
    const cookie = await sesionDe('ana', 'clave-correcta');
    for (const nueva of ['corta1', 'solotexto', '12345678']) {
      const { status, cuerpo } = await cambiar(cookie, 'clave-correcta', nueva);
      assert.equal(status, 400, nueva);
      assert.ok(cuerpo.campos.nueva, nueva);
    }
  });

  test('no permite repetir la actual ni contener el usuario', async () => {
    const cookie = await sesionDe('ana', 'clave-correcta');
    assert.ok((await cambiar(cookie, 'clave-correcta', 'clave-correcta')).status === 400);
    assert.ok((await cambiar(cookie, 'clave-correcta', 'Ana2026segura')).cuerpo.campos.nueva);
  });

  test('cambia la contraseña y cierra las demás sesiones', async () => {
    const otraSesion = await sesionDe('ana', 'clave-correcta');
    const cookie = await sesionDe('ana', 'clave-correcta');

    const { status, res } = await cambiar(cookie, 'clave-correcta', 'MiBuseta2026');
    assert.equal(status, 200);
    assert.equal(res.headers.getSetCookie().filter((c) => c.startsWith('sesion=')).length, 1);

    // La sesión que hizo el cambio sigue viva con su cookie renovada…
    assert.equal((await servidor.pedir('GET', '/api/auth/yo', cookieDe(res))).status, 200);
    // …la otra quedó cerrada.
    assert.equal((await servidor.pedir('GET', '/api/auth/yo', otraSesion)).status, 401);

    assert.equal((await login('ana', 'clave-correcta')).status, 401);
    assert.equal((await login('ana', 'MiBuseta2026')).status, 200);
  });

  test('sin sesión → 401', async () => {
    assert.equal((await cambiar(null, 'x', 'MiBuseta2026')).status, 401);
  });
});

describe('contraseña temporal', () => {
  let conductor;
  let temporal;

  test('el conductor nuevo entra con la temporal pero debe crear la suya', async () => {
    const r = await servidor.pedir('POST', '/api/conductores', admin.cookie, { usuario: 'beto', nombre: 'Beto' });
    ({ conductor, password: temporal } = r.cuerpo);
    assert.equal(conductor.debeCambiarPassword, true);

    const entrar = await login('beto', temporal);
    assert.equal(entrar.status, 200);
    assert.equal(entrar.cuerpo.usuario.debeCambiarPassword, true);
  });

  test('mientras no la cambie, solo puede ver su sesión y cambiarla', async () => {
    const cookie = await sesionDe('beto', temporal);
    assert.equal((await servidor.pedir('GET', '/api/auth/yo', cookie)).status, 200);

    // Un admin en la misma situación tampoco puede usar los módulos.
    const nuevoAdmin = await crearUsuario(db, { usuario: 'admin2' });
    await db.query(`UPDATE usuario SET debe_cambiar_password = TRUE WHERE id = $1`, [nuevoAdmin.id]);
    const bloqueado = await servidor.pedir('GET', '/api/busetas', nuevoAdmin.cookie);
    assert.equal(bloqueado.status, 403);
    assert.match(bloqueado.cuerpo.error, /crear tu propia contraseña/);
  });

  test('al crear la suya queda libre', async () => {
    const cookie = await sesionDe('beto', temporal);
    const { status, cuerpo } = await cambiar(cookie, temporal, 'Colectivos99');
    assert.equal(status, 200);
    assert.equal(cuerpo.usuario.debeCambiarPassword, false);
    assert.equal((await login('beto', 'Colectivos99')).cuerpo.usuario.debeCambiarPassword, false);
  });

  test('la temporal vencida no deja entrar', async () => {
    const r = await servidor.pedir('POST', `/api/conductores/${conductor.id}/restablecer-password`, admin.cookie);
    await db.query(`UPDATE usuario SET password_temporal_hasta = now() - interval '1 minute' WHERE id = $1`, [
      conductor.id,
    ]);
    const { status, cuerpo } = await login('beto', r.cuerpo.password);
    assert.equal(status, 401);
    assert.match(cuerpo.error, /venció/);
  });

  test('restablecer cierra las sesiones abiertas del conductor', async () => {
    const r = await servidor.pedir('POST', `/api/conductores/${conductor.id}/restablecer-password`, admin.cookie);
    const cookie = await sesionDe('beto', r.cuerpo.password);
    await servidor.pedir('POST', `/api/conductores/${conductor.id}/restablecer-password`, admin.cookie);
    assert.equal((await servidor.pedir('GET', '/api/auth/yo', cookie)).status, 401);
  });
});

describe('recuperar contraseña', () => {
  let carla;
  const recuperar = (usuario, ip = '1.1.1.1') =>
    fetch(`${servidor.base}/api/auth/recuperar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-nf-client-connection-ip': ip },
      body: JSON.stringify({ usuario }),
    }).then(async (res) => ({ status: res.status, cuerpo: await res.json() }));
  const solicitudes = async () =>
    (await servidor.pedir('GET', '/api/auth/solicitudes', admin.cookie)).cuerpo.solicitudes;

  before(async () => {
    carla = await crearUsuario(db, { usuario: 'carla', rol: 'conductor' });
  });

  test('responde lo mismo exista o no el usuario', async () => {
    const existe = await recuperar('CARLA');
    const noExiste = await recuperar('nadie');
    assert.equal(existe.status, 202);
    assert.deepEqual(existe, noExiste);
  });

  test('crea una sola solicitud pendiente por conductor', async () => {
    await recuperar('carla');
    const pendientes = await solicitudes();
    assert.deepEqual(pendientes.map((s) => s.usuario), ['carla']);
  });

  test('las solicitudes de un admin no se registran', async () => {
    await recuperar('admin');
    assert.equal((await solicitudes()).length, 1);
  });

  test('solo el admin ve las solicitudes', async () => {
    const r = await servidor.pedir('GET', '/api/auth/solicitudes', carla.cookie);
    assert.equal(r.status, 403);
  });

  test('restablecer la contraseña atiende la solicitud', async () => {
    const r = await servidor.pedir('POST', `/api/conductores/${carla.id}/restablecer-password`, admin.cookie);
    assert.equal(r.status, 200);
    assert.deepEqual(await solicitudes(), []);
    assert.equal((await login('carla', r.cuerpo.password)).cuerpo.usuario.debeCambiarPassword, true);
  });

  test('pedirla muchas veces no llena la tabla', async () => {
    for (let i = 0; i < 20; i++) await recuperar(i % 2 ? 'carla' : `nadie${i}`, '8.8.8.8');
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM solicitud_recuperacion WHERE ip = '8.8.8.8'`);
    assert.equal(rows[0].n, 1);
  });

  test('sin usuario → 400', async () => {
    assert.equal((await recuperar('  ')).status, 400);
  });
});
