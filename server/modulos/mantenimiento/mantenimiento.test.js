import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import { hoyBogota } from '../../compartido/fecha.js';
import { crearBdPrueba, crearUsuario, enDias, iniciarServidor } from '../../compartido/test/helpers.js';

let db;
let servidor;
let admin;
let pedro; // conductor de la buseta 1
let otro; // conductor de la buseta 2
let sinBuseta;
const hoy = hoyBogota();

before(async () => {
  db = await crearBdPrueba();
  await db.query(
    `INSERT INTO buseta (numero_interno, placa, tiene_cupo) VALUES ('101', 'ABC123', true), ('102', 'XYZ789', true)`,
  );
  admin = await crearUsuario(db, { usuario: 'admin' });
  pedro = await crearUsuario(db, { usuario: 'pedro', rol: 'conductor', busetaId: 1 });
  otro = await crearUsuario(db, { usuario: 'otro', rol: 'conductor', busetaId: 2 });
  sinBuseta = await crearUsuario(db, { usuario: 'nuevo', rol: 'conductor' });
  servidor = await iniciarServidor(crearApp({ db }));
});

after(() => servidor.cerrar());

const pedir = (metodo, ruta, quien, cuerpo) => servidor.pedir(metodo, `/api/mantenimiento${ruta}`, quien?.cookie, cuerpo);
const estadoDe = (hoja, tipo) => hoja.estados.find((e) => e.tipo === tipo);

test('sin sesión 401', async () => {
  assert.equal((await pedir('GET', '/1')).status, 401);
  assert.equal((await pedir('GET', '/tipos')).status, 401);
});

test('el conductor solo llega a su buseta (otra o sin buseta → 404)', async () => {
  assert.equal((await pedir('GET', '/1', pedro)).status, 200);
  assert.equal((await pedir('GET', '/2', pedro)).status, 404);
  assert.equal((await pedir('POST', '/2/kilometraje', pedro, { fecha: hoy, kilometraje: 1 })).status, 404);
  // Un conductor sin buseta no hereda el "sin restricción" del admin.
  assert.equal((await pedir('GET', '/1', sinBuseta)).status, 404);
  assert.equal((await pedir('POST', '/1/registros', sinBuseta, { fecha: hoy, items: [{ tipo: 'aceite' }] })).status, 404);
});

test('hoja vacía: sin kilometraje y todo sin registro', async () => {
  const { cuerpo } = await pedir('GET', '/1', pedro);
  assert.equal(cuerpo.kilometraje, null);
  assert.deepEqual(cuerpo.registros, []);
  assert.ok(cuerpo.estados.length > 0);
  assert.ok(cuerpo.estados.every((e) => e.estado === 'sin_registro'));
  assert.equal(cuerpo.estados.some((e) => e.tipo === 'otro'), false);
  assert.ok(cuerpo.tipos.find((t) => t.clave === 'aceite').intervaloKm > 0);
});

test('el conductor reporta el kilometraje; el mismo día lo corrige', async () => {
  let r = await pedir('POST', '/1/kilometraje', pedro, { fecha: enDias(-10, hoy), kilometraje: 118000 });
  assert.equal(r.status, 201);
  r = await pedir('POST', '/1/kilometraje', pedro, { fecha: hoy, kilometraje: 121000 });
  r = await pedir('POST', '/1/kilometraje', pedro, { fecha: hoy, kilometraje: 121500 });
  assert.equal(r.status, 201);
  assert.deepEqual(r.cuerpo.kilometraje, { actual: 121500, fecha: hoy });
  assert.equal(r.cuerpo.lecturas.length, 2);
  assert.equal(r.cuerpo.lecturas[0].editable, true);
});

test('el odómetro no retrocede ni acepta fechas futuras', async () => {
  let r = await pedir('POST', '/1/kilometraje', pedro, { fecha: enDias(-5, hoy), kilometraje: 117000 });
  assert.equal(r.status, 400);
  assert.match(r.cuerpo.campos.kilometraje, /menor.*118\.000/);

  r = await pedir('POST', '/1/kilometraje', pedro, { fecha: enDias(-5, hoy), kilometraje: 122000 });
  assert.equal(r.status, 400);
  assert.match(r.cuerpo.campos.kilometraje, /mayor.*121\.500/);

  r = await pedir('POST', '/1/kilometraje', pedro, { fecha: enDias(1, hoy), kilometraje: 122000 });
  assert.equal(r.status, 400);
  assert.ok(r.cuerpo.campos.fecha);

  r = await pedir('POST', '/1/kilometraje', pedro, { fecha: hoy, kilometraje: -3 });
  assert.equal(r.status, 400);
});

let aceiteId;

test('cambio de aceite con sus filtros en un solo registro', async () => {
  const r = await pedir('POST', '/1/registros', pedro, {
    fecha: enDias(-10, hoy),
    kilometraje: 118000,
    observacion: 'Taller El Pistón',
    items: [
      { tipo: 'aceite', proximoKm: 123000, proximaFecha: enDias(80, hoy) },
      { tipo: 'filtro_aceite', proximoKm: 123000, proximaFecha: '' },
      { tipo: 'filtro_aire', proximoKm: '', proximaFecha: enDias(5, hoy) },
    ],
  });
  assert.equal(r.status, 201);
  assert.equal(r.cuerpo.registros.length, 3);
  assert.equal(r.cuerpo.registros[0].registradoPor.nombre, 'Nombre pedro');

  const aceite = estadoDe(r.cuerpo, 'aceite');
  aceiteId = aceite.ultimo.id;
  assert.equal(aceite.estado, 'al_dia');
  assert.equal(aceite.kmRestantes, 123000 - 121500);
  assert.equal(estadoDe(r.cuerpo, 'filtro_aire').estado, 'pronto'); // vence por fecha en 5 días
  assert.equal(estadoDe(r.cuerpo, 'correas').estado, 'sin_registro');
});

test('validaciones del registro', async () => {
  const base = { fecha: hoy, kilometraje: 121500 };
  let r = await pedir('POST', '/1/registros', pedro, { ...base, items: [] });
  assert.equal(r.status, 400);

  r = await pedir('POST', '/1/registros', pedro, { ...base, items: [{ tipo: 'aceite' }, { tipo: 'aceite' }] });
  assert.equal(r.status, 400);

  r = await pedir('POST', '/1/registros', pedro, { ...base, items: [{ tipo: 'inventado' }] });
  assert.equal(r.status, 400);
  assert.ok(r.cuerpo.campos.tipo);

  r = await pedir('POST', '/1/registros', pedro, { ...base, items: [{ tipo: 'correas', proximoKm: 100 }] });
  assert.equal(r.status, 400);
  assert.ok(r.cuerpo.campos['items.0.proximoKm']);

  r = await pedir('POST', '/1/registros', pedro, { ...base, items: [{ tipo: 'correas', proximaFecha: hoy }] });
  assert.equal(r.status, 400);
  assert.ok(r.cuerpo.campos['items.0.proximaFecha']);

  // El kilometraje del mantenimiento también respeta el odómetro.
  r = await pedir('POST', '/1/registros', pedro, { fecha: hoy, kilometraje: 90000, items: [{ tipo: 'correas' }] });
  assert.equal(r.status, 400);
  assert.ok(r.cuerpo.campos.kilometraje);
});

test('el último registro de cada tipo manda; el kilometraje actual incluye mantenimientos', async () => {
  const r = await pedir('POST', '/1/registros', admin, {
    fecha: hoy,
    kilometraje: 122000,
    items: [{ tipo: 'filtro_aire', proximoKm: 132000, proximaFecha: enDias(180, hoy) }],
  });
  assert.equal(r.status, 201);
  assert.equal(r.cuerpo.kilometraje.actual, 122000);
  const filtro = estadoDe(r.cuerpo, 'filtro_aire');
  assert.equal(filtro.estado, 'al_dia');
  assert.equal(filtro.ultimo.fecha, hoy);
});

test('el conductor no edita lo del admin ni lo suyo después de 7 días', async () => {
  const { cuerpo } = await pedir('GET', '/1', pedro);
  const delAdmin = cuerpo.registros.find((r) => r.registradoPor.nombre === 'Nombre admin');
  assert.equal(delAdmin.editable, false);
  assert.equal((await pedir('DELETE', `/1/registros/${delAdmin.id}`, pedro)).status, 403);

  await db.query(`UPDATE mantenimiento SET creado_en = now() - interval '8 days' WHERE id = $1`, [aceiteId]);
  const viejo = (await pedir('GET', '/1', pedro)).cuerpo.registros.find((r) => r.id === aceiteId);
  assert.equal(viejo.editable, false);
  const r = await pedir('PUT', `/1/registros/${aceiteId}`, pedro, { tipo: 'aceite', fecha: enDias(-10, hoy), kilometraje: 118000 });
  assert.equal(r.status, 403);
  assert.match(r.cuerpo.error, /7 días/);

  // El admin sí puede.
  const delAdminVe = (await pedir('GET', '/1', admin)).cuerpo.registros.find((x) => x.id === aceiteId);
  assert.equal(delAdminVe.editable, true);
});

test('el conductor corrige y borra lo suyo reciente', async () => {
  const { cuerpo } = await pedir('GET', '/1', pedro);
  const filtro = cuerpo.registros.find((r) => r.tipo === 'filtro_aceite');

  let r = await pedir('PUT', `/1/registros/${filtro.id}`, pedro, {
    tipo: 'filtro_aceite',
    fecha: filtro.fecha,
    kilometraje: 118000,
    proximoKm: 124000,
    proximaFecha: null,
    observacion: 'Corregido',
  });
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.registros.find((x) => x.id === filtro.id).proximoKm, 124000);

  r = await pedir('DELETE', `/1/registros/${filtro.id}`, pedro);
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.registros.some((x) => x.id === filtro.id), false);
});

test('no se toca un registro de otra buseta usando la ruta propia', async () => {
  await pedir('POST', '/2/registros', otro, { fecha: hoy, items: [{ tipo: 'bateria', proximaFecha: enDias(700, hoy) }] });
  const ajeno = (await pedir('GET', '/2', admin)).cuerpo.registros[0];
  assert.equal((await pedir('DELETE', `/1/registros/${ajeno.id}`, pedro)).status, 404);
  assert.equal((await pedir('DELETE', `/1/registros/${ajeno.id}`, admin)).status, 404);
});

test('lecturas: no reemplaza la del admin; borra solo lo suyo', async () => {
  const fecha = enDias(-3, hoy);
  await pedir('POST', '/1/kilometraje', admin, { fecha, kilometraje: 120000 });
  let r = await pedir('POST', '/1/kilometraje', pedro, { fecha, kilometraje: 120100 });
  assert.equal(r.status, 409);

  const lecturas = (await pedir('GET', '/1', pedro)).cuerpo.lecturas;
  const delAdmin = lecturas.find((l) => l.fecha === fecha);
  const suya = lecturas.find((l) => l.fecha === hoy);
  assert.equal((await pedir('DELETE', `/1/kilometraje/${delAdmin.id}`, pedro)).status, 403);
  r = await pedir('DELETE', `/1/kilometraje/${suya.id}`, pedro);
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.lecturas.some((l) => l.id === suya.id), false);
});

test('intervalos: los ve cualquiera, los cambia solo el admin', async () => {
  assert.equal((await pedir('GET', '/tipos', pedro)).status, 200);
  assert.equal((await pedir('PUT', '/tipos/aceite', pedro, { intervaloKm: 8000, intervaloMeses: 4 })).status, 403);

  let r = await pedir('PUT', '/tipos/aceite', admin, { intervaloKm: 8000, intervaloMeses: '' });
  assert.equal(r.status, 200);
  assert.deepEqual(
    (({ intervaloKm, intervaloMeses }) => ({ intervaloKm, intervaloMeses }))(r.cuerpo.tipos.find((t) => t.clave === 'aceite')),
    { intervaloKm: 8000, intervaloMeses: null },
  );

  r = await pedir('PUT', '/tipos/aceite', admin, { intervaloKm: 0, intervaloMeses: null });
  assert.equal(r.status, 400);
  assert.equal((await pedir('PUT', '/tipos/inventado', admin, { intervaloKm: 1, intervaloMeses: 1 })).status, 404);
});

test('flota (solo admin): estado de cada buseta activa', async () => {
  assert.equal((await pedir('GET', '', pedro)).status, 403);
  const { status, cuerpo } = await pedir('GET', '', admin);
  assert.equal(status, 200);
  assert.equal(cuerpo.busetas.length, 2);
  const b1 = cuerpo.busetas.find((b) => b.id === 1);
  assert.equal(b1.kilometraje.actual, 122000);
  assert.equal(estadoDe(b1, 'aceite').ultimo.proximoKm, 123000);
  const b2 = cuerpo.busetas.find((b) => b.id === 2);
  assert.equal(b2.kilometraje, null);
  assert.equal(estadoDe(b2, 'bateria').estado, 'al_dia');
});
