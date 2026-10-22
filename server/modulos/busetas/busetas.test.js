import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import { hoyBogota } from '../../compartido/fecha.js';
import { crearBdPrueba, crearUsuario, enDias, iniciarServidor } from '../../compartido/test/helpers.js';

let servidor;
let admin;
let conductor;
const hoy = hoyBogota();

before(async () => {
  const db = await crearBdPrueba();
  admin = await crearUsuario(db, { usuario: 'admin' });
  conductor = await crearUsuario(db, { usuario: 'conductor', rol: 'conductor' });
  servidor = await iniciarServidor(crearApp({ db }));
});

after(() => servidor.cerrar());

const pedir = (metodo, ruta, quien, cuerpo) => servidor.pedir(metodo, `/api/busetas${ruta}`, quien?.cookie, cuerpo);

const NUEVA = {
  numeroInterno: '101',
  placa: 'abc-123',
  modelo: 'NPR 2020',
  tieneCupo: true,
  valorArriendo: 500000, // se ignora: tiene cupo
};

let busetaId;

test('sin sesión 401; conductor 403', async () => {
  assert.equal((await pedir('GET', '')).status, 401);
  assert.equal((await pedir('GET', '', conductor)).status, 403);
  assert.equal((await pedir('POST', '', conductor, NUEVA)).status, 403);
});

test('crear normaliza la placa y calcula el estado de documentos', async () => {
  const { status, cuerpo } = await pedir('POST', '', admin, {
    ...NUEVA,
    fechaSoat: enDias(10, hoy),
    fechaTecnomecanica: enDias(-1, hoy),
  });
  assert.equal(status, 201);
  const b = cuerpo.buseta;
  busetaId = b.id;
  assert.equal(b.placa, 'ABC123');
  assert.equal(b.valorArriendo, null);
  assert.equal(b.conductor, null);
  assert.deepEqual(b.documentos.soat, { fecha: enDias(10, hoy), estado: 'por_vencer', dias: 10 });
  assert.equal(b.documentos.tecnomecanica.estado, 'vencido');
});

test('sin cupo exige arriendo', async () => {
  const { status, cuerpo } = await pedir('POST', '', admin, { ...NUEVA, numeroInterno: '102', placa: 'DEF456', tieneCupo: false, valorArriendo: null });
  assert.equal(status, 400);
  assert.match(cuerpo.campos.valorArriendo, /arriendo/);
});

test('placa o número interno duplicado → 409; placa inválida → 400', async () => {
  const placa = await pedir('POST', '', admin, { ...NUEVA, numeroInterno: '103', placa: 'ABC123' });
  assert.equal(placa.status, 409);
  assert.ok(placa.cuerpo.campos.placa);

  const numero = await pedir('POST', '', admin, { ...NUEVA, placa: 'XYZ789' });
  assert.equal(numero.status, 409);
  assert.ok(numero.cuerpo.campos.numeroInterno);

  const mala = await pedir('POST', '', admin, { ...NUEVA, numeroInterno: '104', placa: 'A!' });
  assert.equal(mala.status, 400);
  assert.ok(mala.cuerpo.campos.placa);
});

test('editar actualiza datos y fechas de documentos', async () => {
  const { status, cuerpo } = await pedir('PUT', `/${busetaId}`, admin, {
    numeroInterno: '101', placa: 'ABC123', modelo: null, tieneCupo: false, valorArriendo: 1200000,
    fechaSoat: enDias(200, hoy), fechaTecnomecanica: '', activo: true,
  });
  assert.equal(status, 200);
  assert.equal(cuerpo.buseta.valorArriendo, 1200000);
  assert.equal(cuerpo.buseta.documentos.soat.estado, 'vigente');
  assert.equal(cuerpo.buseta.documentos.tecnomecanica.estado, 'sin_fecha');
});

test('listar devuelve la flota', async () => {
  const { cuerpo } = await pedir('GET', '', admin);
  assert.deepEqual(cuerpo.busetas.map((b) => b.placa), ['ABC123']);
});

test('id inexistente o inválido → 404', async () => {
  assert.equal((await pedir('GET', '/9999', admin)).status, 404);
  assert.equal((await pedir('GET', '/abc', admin)).status, 404);
  assert.equal((await pedir('PUT', '/9999', admin, { ...NUEVA, placa: 'QQQ111', activo: true })).status, 404);
});
