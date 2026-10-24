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

describe('permisos', () => {
  test('sin sesión 401; el conductor no usa las rutas del admin; el admin no usa /mio', async () => {
    assert.equal((await pedir('GET', '/mio')).status, 401);
    assert.equal((await pedir('GET', '', pedro)).status, 403);
    assert.equal((await pedir('PUT', '/1', pedro, { desde: '2026-10-01' })).status, 403);
    assert.equal((await pedir('POST', '/1/liquidaciones', pedro, { desde: '2026-10-01', hasta: '2026-10-02' })).status, 403);
    assert.equal((await pedir('GET', '/mio', admin)).status, 403);
  });

  test('conductor sin Colpass o sin buseta: no hay nada que mostrar', async () => {
    assert.deepEqual((await pedir('GET', '/mio', carlos)).cuerpo, { colpass: null });
    assert.deepEqual((await pedir('GET', '/mio', sinBuseta)).cuerpo, { colpass: null });
  });
});

describe('Colpass de la 2033', () => {
  test('el admin lo activa desde una fecha (no futura)', async () => {
    const futura = await pedir('PUT', '/1', admin, { desde: enDias(1, hoyBogota()) });
    assert.equal(futura.status, 400);
    const { status, cuerpo } = await pedir('PUT', '/1', admin, { desde: '2026-10-01' });
    assert.equal(status, 200);
    assert.equal(cuerpo.colpass.desde, '2026-10-01');
  });

  test('la lista del admin muestra lo pendiente por liquidar de cada buseta', async () => {
    const { cuerpo } = await pedir('GET', '', admin);
    const [b2033, b2007] = ['2033', '2007'].map((n) => cuerpo.busetas.find((b) => b.numeroInterno === n));
    // Solo desde el Colpass (no cuenta el 28/09) y sin días en cero.
    assert.deepEqual(b2033.pendiente, { total: 301400, dias: 3, desde: '2026-10-01', hasta: '2026-10-05' });
    assert.equal(b2007.colpass, null);
    assert.equal(b2007.pendiente, null);
  });

  test('el conductor consulta de una fecha a otra', async () => {
    const { status, cuerpo } = await pedir('GET', `/mio${OCTUBRE}`, pedro);
    assert.equal(status, 200);
    assert.equal(cuerpo.buseta.numeroInterno, '2033');
    assert.deepEqual(cuerpo.consulta.dias.map((d) => d.fecha), ['2026-09-28', '2026-10-01', '2026-10-02', '2026-10-05']);
    assert.equal(cuerpo.consulta.total, 351400); // todos los peajes del rango
    assert.equal(cuerpo.consulta.porLiquidar, 301400); // el 28/09 se pagó en efectivo
    assert.equal(cuerpo.pendiente.total, 301400);

    const corto = await pedir('GET', '/mio?desde=2026-10-02&hasta=2026-10-02', pedro);
    assert.equal(corto.cuerpo.consulta.total, 84800);
    assert.equal((await pedir('GET', '/mio?desde=2026-10-05&hasta=2026-10-01', pedro)).status, 400);
  });

  test('el admin liquida un rango: el valor sale de los peajes del producido', async () => {
    const { status, cuerpo } = await pedir('POST', `/1/liquidaciones${OCTUBRE}`, admin, {
      desde: '2026-10-01',
      hasta: '2026-10-02',
      observacion: 'Entregó en efectivo',
    });
    assert.equal(status, 201);
    assert.equal(cuerpo.liquidaciones.length, 1);
    assert.equal(cuerpo.liquidaciones[0].valor, 174200);
    assert.equal(cuerpo.pendiente.total, 127200);
    assert.equal(cuerpo.consulta.liquidado, 174200);
    assert.deepEqual(cuerpo.consulta.dias.filter((d) => d.liquidado).map((d) => d.fecha), ['2026-10-01', '2026-10-02']);
  });

  test('el conductor ve la liquidación, sin las notas del admin', async () => {
    const { cuerpo } = await pedir('GET', `/mio${OCTUBRE}`, pedro);
    assert.equal(cuerpo.pendiente.total, 127200);
    assert.deepEqual(Object.keys(cuerpo.liquidaciones[0]).sort(), ['creadoEn', 'desde', 'hasta', 'id', 'valor']);
  });

  test('validaciones al liquidar', async () => {
    const liquidar = (desde, hasta, busetaId = 1) => pedir('POST', `/${busetaId}/liquidaciones`, admin, { desde, hasta });
    const cruce = await liquidar('2026-10-02', '2026-10-05');
    assert.equal(cruce.status, 409);
    assert.match(cruce.cuerpo.error, /01\/10\/2026 al 02\/10\/2026/);
    assert.match((await liquidar('2026-09-28', '2026-10-01')).cuerpo.error, /Colpass empezó/);
    assert.equal((await liquidar('2026-10-05', enDias(1, hoyBogota()))).status, 400);
    assert.match((await liquidar('2026-10-03', '2026-10-04')).cuerpo.error, /No hay peajes/);
    assert.equal((await liquidar('2026-10-05', '2026-10-04')).status, 400);
    assert.equal((await liquidar('2026-10-01', '2026-10-01', 2)).status, 404); // la 2007 no tiene Colpass
  });

  test('si el producido se corrige después de liquidar, se ve la diferencia', async () => {
    await db.query(`UPDATE producido_diario SET peajes = 90000 WHERE buseta_id = 1 AND fecha = '2026-10-01'`);
    const { cuerpo } = await pedir('GET', '/1', admin);
    assert.equal(cuerpo.liquidaciones[0].valor, 174200);
    assert.equal(cuerpo.liquidaciones[0].valorActual, 174800);
  });

  test('borrar una liquidación vuelve a dejar esos días pendientes', async () => {
    const { cuerpo } = await pedir('GET', '/1', admin);
    const id = cuerpo.liquidaciones[0].id;
    assert.equal((await pedir('DELETE', `/2/liquidaciones/${id}`, admin)).status, 404);
    const r = await pedir('DELETE', `/1/liquidaciones/${id}`, admin);
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.liquidaciones.length, 0);
    assert.equal(r.cuerpo.pendiente.total, 302000);
  });

  test('quitar el Colpass', async () => {
    await pedir('POST', '/1/liquidaciones', admin, { desde: '2026-10-01', hasta: '2026-10-05' });
    assert.equal((await pedir('DELETE', '/1', admin)).status, 204);
    assert.deepEqual((await pedir('GET', '/mio', pedro)).cuerpo, { colpass: null });
    assert.equal((await pedir('GET', '/1', admin)).status, 404);
    // Las liquidaciones hechas se conservan.
    const { rows } = await db.query('SELECT count(*)::int AS n FROM liquidacion_peaje');
    assert.equal(rows[0].n, 1);
  });
});
