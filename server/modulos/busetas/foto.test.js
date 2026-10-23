import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import {
  IMAGEN_JPG,
  crearAlmacenMemoria,
  crearBdPrueba,
  crearUsuario,
  iniciarServidor,
} from '../../compartido/test/helpers.js';

let servidor;
let almacen;
let admin;
let conductor;

before(async () => {
  const db = await crearBdPrueba();
  await db.query(`INSERT INTO buseta (numero_interno, placa, tiene_cupo) VALUES ('101', 'ABC123', true)`);
  admin = await crearUsuario(db, { usuario: 'admin' });
  conductor = await crearUsuario(db, { usuario: 'pedro', rol: 'conductor', busetaId: 1 });
  almacen = crearAlmacenMemoria();
  servidor = await iniciarServidor(crearApp({ db, almacen }));
});

after(() => servidor.cerrar());

const subir = (quien, contenido = IMAGEN_JPG, tipo = 'image/jpeg', id = 1) =>
  servidor.pedirArchivo('PUT', `/api/busetas/${id}/foto`, quien?.cookie, { contenido, tipo });
const ver = (quien, id = 1) => servidor.pedirArchivo('GET', `/api/busetas/${id}/foto`, quien?.cookie);

test('sin foto: la buseta trae foto null y pedirla da 404', async () => {
  const { cuerpo } = await servidor.pedir('GET', '/api/busetas/1', admin.cookie);
  assert.equal(cuerpo.buseta.foto, null);
  assert.equal((await ver(admin)).status, 404);
});

test('solo el admin sube la foto', async () => {
  assert.equal((await subir()).status, 401);
  assert.equal((await subir(conductor)).status, 403);
  assert.equal(almacen.archivos.size, 0);
});

test('rechaza lo que no es imagen aunque diga serlo', async () => {
  let r = await subir(admin, Buffer.from('<script>alert(1)</script>'), 'image/jpeg');
  assert.equal(r.status, 400);
  assert.match(r.cuerpo.error, /JPG, PNG o WebP/);

  r = await subir(admin, Buffer.from('%PDF-1.4'), 'application/pdf');
  assert.equal(r.status, 400);

  r = await subir(admin, Buffer.alloc(4 * 1024 * 1024, 0xff), 'image/jpeg');
  assert.equal(r.status, 413);
  assert.match(r.cuerpo.error, /3 MB/);
  assert.equal(almacen.archivos.size, 0);
});

let primera;

test('el admin sube la foto al bucket privado y se ve por URL firmada', async () => {
  const r = await subir(admin);
  assert.equal(r.status, 200);
  primera = r.cuerpo.buseta.foto;
  assert.match(primera, /^1\/\d+\.jpg$/);
  assert.equal(almacen.archivos.get(`busetas/${primera}`).tipo, 'image/jpeg');

  const foto = await ver(admin);
  assert.equal(foto.status, 302);
  assert.equal(foto.res.headers.get('location'), `https://almacen.prueba/busetas/${primera}?expira=600`);
  assert.match(foto.res.headers.get('cache-control'), /private/);
});

test('reemplazarla borra la anterior; quitarla la borra del bucket', async () => {
  await new Promise((r) => setTimeout(r, 5)); // nombre distinto (marca de tiempo)
  const r = await subir(admin);
  const segunda = r.cuerpo.buseta.foto;
  assert.notEqual(segunda, primera);
  assert.deepEqual([...almacen.archivos.keys()], [`busetas/${segunda}`]);

  const quitar = await servidor.pedir('DELETE', '/api/busetas/1/foto', admin.cookie);
  assert.equal(quitar.status, 200);
  assert.equal(quitar.cuerpo.buseta.foto, null);
  assert.equal(almacen.archivos.size, 0);
});

test('buseta inexistente → 404', async () => {
  assert.equal((await subir(admin, IMAGEN_JPG, 'image/jpeg', 99)).status, 404);
});
