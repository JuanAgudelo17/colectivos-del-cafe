import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import { hoyBogota } from '../../compartido/fecha.js';
import { crearBdPrueba, crearUsuario, enDias, iniciarServidor } from '../../compartido/test/helpers.js';

let db;
let servidor;
let admin;
let pedro;
let carlos;
let sinBuseta;

before(async () => {
  db = await crearBdPrueba();
  await db.exec(`
    INSERT INTO buseta (numero_interno, placa) VALUES ('2033', 'SOT112');
    INSERT INTO buseta (numero_interno, placa) VALUES ('2007', 'TXA235');
  `);
  admin = await crearUsuario(db, { usuario: 'admin' });
  pedro = await crearUsuario(db, { usuario: 'pedro', rol: 'conductor', busetaId: 1 });
  carlos = await crearUsuario(db, { usuario: 'carlos', rol: 'conductor', busetaId: 2 });
  sinBuseta = await crearUsuario(db, { usuario: 'nuevo', rol: 'conductor' });
  // [buseta, conductor, fecha, peajes]. El 28/09 es antes del Colpass; el 03/10 no tuvo peajes.
  const dias = [
    [1, pedro.id, '2026-09-28', 50000],
    [1, pedro.id, '2026-10-01', 89400],
    [1, pedro.id, '2026-10-02', 84800],
    [1, pedro.id, '2026-10-03', 0],
    [1, pedro.id, '2026-10-05', 127200],
    [2, carlos.id, '2026-10-01', 99999],
  ];
  for (const [busetaId, conductorId, fecha, peajes] of dias) {
    await db.query(
      `INSERT INTO producido_diario (buseta_id, conductor_id, fecha, ingreso, peajes, creado_por)
       VALUES ($1, $2, $3, 500000, $4, $5)`,
      [busetaId, conductorId, fecha, peajes, admin.id],
    );
  }
  servidor = await iniciarServidor(crearApp({ db }));
});

after(() => servidor.cerrar());

const pedir = (metodo, ruta, quien, cuerpo) => servidor.pedir(metodo, `/api/colpass${ruta}`, quien?.cookie, cuerpo);
const OCTUBRE = '?desde=2026-09-25&hasta=2026-10-31';
const entregar = (quien, valor, fecha = '2026-10-10', ruta = '/mio/entregas') =>
  pedir('POST', `${ruta}${OCTUBRE}`, quien, { fecha, valor, observacion: 'En efectivo' });

describe('permisos', () => {
  test('sin sesión 401; el conductor no usa las rutas del admin; el admin no usa /mio', async () => {
    assert.equal((await pedir('GET', '/mio')).status, 401);
    assert.equal((await pedir('GET', '', pedro)).status, 403);
    assert.equal((await pedir('PUT', '/1', pedro, { desde: '2026-10-01' })).status, 403);
    assert.equal((await pedir('POST', '/1/entregas', pedro, { fecha: '2026-10-01', valor: 1 })).status, 403);
    assert.equal((await pedir('GET', '/mio', admin)).status, 403);
    assert.equal((await pedir('POST', '/mio/entregas', admin, { fecha: '2026-10-01', valor: 1 })).status, 403);
  });

  test('conductor sin Colpass o sin buseta: nada que mostrar ni registrar', async () => {
    assert.deepEqual((await pedir('GET', '/mio', carlos)).cuerpo, { colpass: null });
    assert.deepEqual((await pedir('GET', '/mio', sinBuseta)).cuerpo, { colpass: null });
    assert.equal((await entregar(carlos, 1000)).status, 404);
    assert.equal((await entregar(sinBuseta, 1000)).status, 404);
  });
});

describe('Colpass de la 2033', () => {
  test('el admin lo activa desde una fecha (no futura)', async () => {
    assert.equal((await pedir('PUT', '/1', admin, { desde: enDias(1, hoyBogota()) })).status, 400);
    const { status, cuerpo } = await pedir('PUT', '/1', admin, { desde: '2026-10-01' });
    assert.equal(status, 200);
    assert.equal(cuerpo.colpass.desde, '2026-10-01');
  });

  test('lo pendiente cuenta desde el Colpass y sin días en cero', async () => {
    const { cuerpo } = await pedir('GET', '', admin);
    const b2033 = cuerpo.busetas.find((b) => b.numeroInterno === '2033');
    assert.deepEqual(b2033.pendiente, { total: 301400, dias: 3, desde: '2026-10-01', hasta: '2026-10-05' });
    assert.equal(cuerpo.busetas.find((b) => b.numeroInterno === '2007').colpass, null);
  });

  test('el conductor consulta de una fecha a otra', async () => {
    const { status, cuerpo } = await pedir('GET', `/mio${OCTUBRE}`, pedro);
    assert.equal(status, 200);
    assert.deepEqual(
      cuerpo.consulta.dias.map((d) => [d.fecha, d.estado]),
      [
        ['2026-09-28', 'antes'],
        ['2026-10-01', 'pendiente'],
        ['2026-10-02', 'pendiente'],
        ['2026-10-05', 'pendiente'],
      ],
    );
    assert.equal(cuerpo.consulta.total, 351400);
    assert.equal(cuerpo.consulta.porLiquidar, 301400); // el 28/09 se pagó en efectivo
    assert.equal(cuerpo.pendiente.total, 301400);
    assert.deepEqual(cuerpo.entregas, []);
  });

  test('el conductor registra lo que entregó: cubre los días más viejos y queda liquidado', async () => {
    const { status, cuerpo } = await entregar(pedro, 100000);
    assert.equal(status, 201);
    assert.equal(cuerpo.pendiente.total, 201400);
    assert.deepEqual(
      cuerpo.consulta.dias.filter((d) => d.estado !== 'antes').map((d) => [d.fecha, d.estado, d.cubierto]),
      [
        ['2026-10-01', 'liquidado', 89400],
        ['2026-10-02', 'parcial', 10600],
        ['2026-10-05', 'pendiente', 0],
      ],
    );
    assert.deepEqual(cuerpo.entregas[0], {
      id: cuerpo.entregas[0].id,
      fecha: '2026-10-10',
      valor: 100000,
      observacion: 'En efectivo',
      cubre: { desde: '2026-10-01', hasta: '2026-10-02' },
      registradaPor: 'conductor',
      puedeBorrar: true,
    });
  });

  test('validaciones al entregar', async () => {
    const demas = await entregar(pedro, 201401);
    assert.equal(demas.status, 400);
    assert.match(demas.cuerpo.error, /Solo hay \$ 201\.400 de peajes pendientes/);
    assert.match((await entregar(pedro, 1000, '2026-09-30')).cuerpo.error, /Colpass empezó el 01\/10\/2026/);
    assert.equal((await entregar(pedro, 1000, enDias(1, hoyBogota()))).status, 400);
    assert.equal((await entregar(pedro, 0)).status, 400);
    assert.equal((await entregar(pedro, 10.5)).status, 400);
  });

  test('el admin también registra entregas; con todo entregado no se puede entregar más', async () => {
    const { status, cuerpo } = await entregar(admin, 201400, '2026-10-12', '/1/entregas');
    assert.equal(status, 201);
    assert.deepEqual(cuerpo.pendiente, { total: 0, dias: 0, desde: null, hasta: null });
    assert.equal(cuerpo.entregas[0].registradaPor, 'admin');
    assert.deepEqual(cuerpo.entregas[0].cubre, { desde: '2026-10-02', hasta: '2026-10-05' });
    assert.match((await entregar(pedro, 1000)).cuerpo.error, /No hay peajes pendientes/);
  });

  test('el conductor ve las entregas del admin pero no las puede borrar', async () => {
    const { cuerpo } = await pedir('GET', '/mio', pedro);
    const delAdmin = cuerpo.entregas.find((e) => e.registradaPor === 'admin');
    assert.equal(delAdmin.puedeBorrar, false);
    const r = await pedir('DELETE', `/mio/entregas/${delAdmin.id}`, pedro);
    assert.equal(r.status, 403);
  });

  test('el conductor borra lo suyo solo durante 7 días', async () => {
    const { cuerpo } = await pedir('GET', '/mio', pedro);
    const suya = cuerpo.entregas.find((e) => e.registradaPor === 'conductor');
    await db.query(`UPDATE liquidacion_peaje SET creado_en = now() - interval '8 days' WHERE id = $1`, [suya.id]);
    assert.equal((await pedir('DELETE', `/mio/entregas/${suya.id}`, pedro)).status, 403);

    await db.query(`UPDATE liquidacion_peaje SET creado_en = now() WHERE id = $1`, [suya.id]);
    const r = await pedir('DELETE', `/mio/entregas/${suya.id}`, pedro);
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.pendiente.total, 100000);
    // La del admin ahora cubre desde el día más viejo.
    assert.deepEqual(r.cuerpo.entregas[0].cubre, { desde: '2026-10-01', hasta: '2026-10-05' });
  });

  test('si se bajan peajes en el producido después de entregar, queda saldo a favor', async () => {
    await db.query(`UPDATE producido_diario SET peajes = 0 WHERE buseta_id = 1 AND fecha = '2026-10-05'`);
    const { cuerpo } = await pedir('GET', '/1', admin);
    assert.equal(cuerpo.pendiente.total, 0);
    assert.equal(cuerpo.saldoAFavor, 201400 - 174200);
  });

  test('el admin borra cualquier entrega; una de otra buseta no existe', async () => {
    const { cuerpo } = await pedir('GET', '/1', admin);
    const id = cuerpo.entregas[0].id;
    assert.equal((await pedir('DELETE', `/2/entregas/${id}`, admin)).status, 404);
    const r = await pedir('DELETE', `/1/entregas/${id}`, admin);
    assert.equal(r.status, 200);
    assert.deepEqual(r.cuerpo.entregas, []);
  });

  test('quitar el Colpass conserva las entregas', async () => {
    await entregar(pedro, 1000);
    assert.equal((await pedir('DELETE', '/1', admin)).status, 204);
    assert.deepEqual((await pedir('GET', '/mio', pedro)).cuerpo, { colpass: null });
    const sinColpass = await pedir('GET', '/1', admin);
    assert.deepEqual(sinColpass.cuerpo, { buseta: { id: 1, numeroInterno: '2033' }, colpass: null });
    const { rows } = await db.query('SELECT count(*)::int AS n FROM liquidacion_peaje');
    assert.equal(rows[0].n, 1);
  });
});
