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

let db;
let servidor;
let almacen;
let admin;
let pedro;
let ana;

before(async () => {
  db = await crearBdPrueba();
  await db.exec(`
    INSERT INTO buseta (numero_interno, placa) VALUES ('2033', 'SOT112');
    INSERT INTO buseta (numero_interno, placa) VALUES ('2007', 'TXA235');
    INSERT INTO buseta (numero_interno, placa) VALUES ('2041', 'TSE972');
  `);
  admin = await crearUsuario(db, { usuario: 'admin' });
  pedro = await crearUsuario(db, { usuario: 'pedro', rol: 'conductor', busetaId: 1 });
  ana = await crearUsuario(db, { usuario: 'ana', rol: 'conductor', busetaId: 2 });
  almacen = crearAlmacenMemoria();
  servidor = await iniciarServidor(crearApp({ db, almacen }));
});

after(() => servidor.cerrar());

const pedir = (metodo, ruta, quien, cuerpo) => servidor.pedir(metodo, `/api/facturas${ruta}`, quien?.cookie, cuerpo);
const subirFoto = (quien, id, contenido = IMAGEN_JPG, tipo = 'image/jpeg') =>
  servidor.pedirArchivo('PUT', `/api/facturas/${id}/foto`, quien?.cookie, { contenido, tipo });
const FACTURA = { fecha: '2026-10-05', categoria: 'mantenimiento', descripcion: 'Pastillas de freno', precio: 180000 };

test('hace falta sesión; se valida lo mínimo (fecha, descripción, precio)', async () => {
  assert.equal((await pedir('POST', '', null, FACTURA)).status, 401);
  const r = await pedir('POST', '', pedro, { fecha: '2099-01-01', descripcion: '', precio: 0 });
  assert.equal(r.status, 400);
  assert.ok(r.cuerpo.campos.fecha && r.cuerpo.campos.descripcion && r.cuerpo.campos.precio);
});

test('el conductor registra en su buseta (aunque mande otra)', async () => {
  // El formulario del conductor manda busetaId vacío.
  assert.equal((await pedir('POST', '', pedro, { ...FACTURA, descripcion: 'Con buseta vacía', busetaId: null })).status, 201);
  await db.query(`DELETE FROM factura WHERE descripcion = 'Con buseta vacía'`);
  const r = await pedir('POST', '', pedro, { ...FACTURA, busetaId: 2 });
  assert.equal(r.status, 201);
  assert.equal(r.cuerpo.factura.busetaId, 1);
  assert.equal(r.cuerpo.factura.conductorId, pedro.id);
  assert.equal(r.cuerpo.factura.tieneFoto, false);
  assert.equal(r.cuerpo.factura.editable, true);
});

test('el admin registra en la buseta que elija, a nombre de su conductor', async () => {
  assert.equal((await pedir('POST', '', admin, FACTURA)).status, 400);
  assert.equal((await pedir('POST', '', admin, { ...FACTURA, busetaId: 3 })).status, 400, 'la 2041 no tiene conductor');
  const r = await pedir('POST', '', admin, { ...FACTURA, busetaId: 2, categoria: 'acpm', descripcion: 'ACPM', precio: 95000 });
  assert.equal(r.status, 201);
  assert.equal(r.cuerpo.factura.conductorId, ana.id);
});

test('cada conductor ve solo las de su buseta; el admin, todas o las de una', async () => {
  const dePedro = await pedir('GET', '?anio=2026&mes=10&busetaId=2', pedro);
  assert.deepEqual(dePedro.cuerpo.facturas.map((f) => f.busetaId), [1]);
  assert.equal(dePedro.cuerpo.total, 180000);
  assert.equal((await pedir('GET', '?anio=2026&mes=10', admin)).cuerpo.facturas.length, 2);
  assert.equal((await pedir('GET', '?anio=2026&mes=10&busetaId=2', admin)).cuerpo.facturas.length, 1);
  assert.equal((await pedir('GET', '?anio=2026&mes=9', admin)).cuerpo.facturas.length, 0);
});

test('foto: la sube quien puede editarla, se ve con URL firmada y la reemplaza', async () => {
  const id = (await pedir('GET', '?anio=2026&mes=10', pedro)).cuerpo.facturas[0].id;
  assert.equal((await subirFoto(ana, id)).status, 404, 'otra buseta: ni la ve');
  assert.equal((await subirFoto(pedro, id, Buffer.from('no es imagen'))).status, 400);

  const r = await subirFoto(pedro, id);
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.factura.tieneFoto, true);
  const [ruta] = [...almacen.archivos.keys()];
  assert.match(ruta, new RegExp(`^facturas/1/${id}-\\d+\\.jpg$`));

  const ver = await servidor.pedirArchivo('GET', `/api/facturas/${id}/foto`, admin.cookie);
  assert.equal(ver.status, 302);
  assert.match(ver.res.headers.get('location'), /^https:\/\/almacen\.prueba\/facturas\/1\//);
  assert.equal((await servidor.pedirArchivo('GET', `/api/facturas/${id}/foto`, ana.cookie)).status, 404);

  await subirFoto(pedro, id);
  assert.equal(almacen.archivos.size, 1, 'la foto anterior se borra');
});

test('el conductor no puede cambiar facturas de hace más de 7 días; el admin sí', async () => {
  const { cuerpo } = await pedir('POST', '', pedro, { ...FACTURA, descripcion: 'Vieja' });
  await db.query(`UPDATE factura SET creado_en = now() - interval '8 days' WHERE id = $1`, [cuerpo.factura.id]);
  const lista = (await pedir('GET', '?anio=2026&mes=10', pedro)).cuerpo.facturas;
  assert.equal(lista.find((f) => f.id === cuerpo.factura.id).editable, false);
  assert.equal((await pedir('DELETE', `/${cuerpo.factura.id}`, pedro)).status, 403);
  assert.equal((await pedir('DELETE', `/${cuerpo.factura.id}`, admin)).status, 204);
});

test('borrar quita también la foto', async () => {
  const id = (await pedir('GET', '?anio=2026&mes=10', pedro)).cuerpo.facturas[0].id;
  assert.equal((await pedir('DELETE', `/${id}`, ana)).status, 404);
  assert.equal((await pedir('DELETE', `/${id}`, pedro)).status, 204);
  assert.equal(almacen.archivos.size, 0);
});

test('con el mes cerrado no se agregan ni se cambian facturas', async () => {
  await db.query(
    `INSERT INTO cierre_mensual (buseta_id, anio, mes, bruto, reposicion, empresa, conductor, peajes, salidas,
       mantenimiento, arriendo, acpm, neto, estado, cerrado_por, cerrado_en)
     VALUES (2, 2026, 10, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 'cerrado', $1, now())`,
    [admin.id],
  );
  assert.equal((await pedir('POST', '', ana, FACTURA)).status, 409);
  const id = (await pedir('GET', '?anio=2026&mes=10', ana)).cuerpo.facturas[0].id;
  assert.equal((await pedir('DELETE', `/${id}`, admin)).status, 409);
  assert.equal((await pedir('POST', '', ana, { ...FACTURA, fecha: '2026-09-30' })).status, 201, 'otro mes sí');
});
