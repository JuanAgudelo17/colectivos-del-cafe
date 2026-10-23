import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import { hoyBogota } from '../../compartido/fecha.js';
import { crearAlmacenMemoria, crearBdPrueba, crearUsuario, enDias, iniciarServidor } from '../../compartido/test/helpers.js';

let servidor;
let conBuseta;
let sinBuseta;
let admin;
const hoy = hoyBogota();

before(async () => {
  const db = await crearBdPrueba();
  await db.query(
    `INSERT INTO buseta (numero_interno, placa, modelo, tiene_cupo, valor_arriendo) VALUES
       ('101', 'ABC123', 'NPR', false, 1500000),
       ('102', 'XYZ789', 'Busscar', true, NULL)`,
  );
  await db.query(
    `INSERT INTO documento_buseta (buseta_id, fecha_soat, fecha_tecnomecanica) VALUES (1, $1, $2), (2, $3, NULL)`,
    [enDias(-2, hoy), enDias(10, hoy), enDias(200, hoy)],
  );
  conBuseta = await crearUsuario(db, { usuario: 'pedro', rol: 'conductor', busetaId: 1 });
  await crearUsuario(db, { usuario: 'otro', rol: 'conductor', busetaId: 2 });
  sinBuseta = await crearUsuario(db, { usuario: 'nuevo', rol: 'conductor' });
  admin = await crearUsuario(db, { usuario: 'admin' });
  await db.query(`UPDATE buseta SET foto_path = '1/1700000000000.jpg' WHERE id = 1`);
  servidor = await iniciarServidor(crearApp({ db, almacen: crearAlmacenMemoria() }));
});

after(() => servidor.cerrar());

const pedir = (quien) => servidor.pedir('GET', '/api/mi-buseta', quien?.cookie);

test('el conductor ve solo su buseta, con el estado de sus documentos', async () => {
  const { status, cuerpo } = await pedir(conBuseta);
  assert.equal(status, 200);
  assert.equal(cuerpo.buseta.placa, 'ABC123');
  assert.equal(cuerpo.buseta.documentos.soat.estado, 'vencido');
  assert.equal(cuerpo.buseta.documentos.tecnomecanica.estado, 'por_vencer');
});

test('no expone el valor del arriendo ni el conductor', async () => {
  const { cuerpo } = await pedir(conBuseta);
  assert.equal('valorArriendo' in cuerpo.buseta, false);
  assert.equal('conductor' in cuerpo.buseta, false);
});

test('sin buseta asignada devuelve null', async () => {
  const { status, cuerpo } = await pedir(sinBuseta);
  assert.equal(status, 200);
  assert.equal(cuerpo.buseta, null);
});

test('sin sesión 401; el admin no usa este módulo (403)', async () => {
  assert.equal((await pedir()).status, 401);
  assert.equal((await pedir(admin)).status, 403);
});

test('trae todos los documentos, también los legales', async () => {
  const { cuerpo } = await pedir(conBuseta);
  assert.deepEqual(Object.keys(cuerpo.buseta.documentos), [
    'soat', 'tecnomecanica', 'tarjetaOperacion', 'polizaRcc', 'polizaRce', 'extintor',
  ]);
  assert.equal(cuerpo.buseta.documentos.extintor.estado, 'sin_fecha');
});

test('foto: el conductor ve la de su buseta; sin foto o sin buseta 404', async () => {
  const verFoto = (quien) => servidor.pedirArchivo('GET', '/api/mi-buseta/foto', quien?.cookie);
  const { cuerpo } = await pedir(conBuseta);
  assert.equal(cuerpo.buseta.foto, '1/1700000000000.jpg');

  const foto = await verFoto(conBuseta);
  assert.equal(foto.status, 302);
  assert.equal(foto.res.headers.get('location'), 'https://almacen.prueba/busetas/1/1700000000000.jpg?expira=600');

  assert.equal((await verFoto(sinBuseta)).status, 404);
  assert.equal((await verFoto(admin)).status, 403);
  assert.equal((await verFoto()).status, 401);
});
