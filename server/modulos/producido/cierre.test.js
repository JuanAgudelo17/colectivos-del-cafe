import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import { crearBdPrueba, crearUsuario, iniciarServidor } from '../../compartido/test/helpers.js';

let db;
let servidor;
let admin;
let carlos;

// Liquidación real de la cooperativa: microbús 2007, agosto de 2026.
const AGOSTO = {
  anio: 2026,
  mes: 8,
  fecha: '2026-09-23',
  totalBruto: 10427500,
  administracion: 2085500,
  polizas: 0,
  fondoReposicion: 42500,
  salidas: 425800,
  combustibles: 0,
  peajes: 1867400,
  prestamos: 306540,
  salarioConductor: 1833333,
  prestacionesConductor: 391207,
  seguridadSocialConductor: 329151,
  salarioRelevo: '',
  prestacionesRelevo: '',
  seguridadSocialRelevo: '',
  vacacionesRelevo: '',
  netoAPagar: 3146069,
};

before(async () => {
  db = await crearBdPrueba();
  await db.exec(`
    INSERT INTO buseta (numero_interno, placa, tiene_cupo, valor_arriendo) VALUES ('2007', 'TXA235', false, 300000);
    INSERT INTO buseta (numero_interno, placa) VALUES ('2033', 'SOT112');
  `);
  admin = await crearUsuario(db, { usuario: 'admin' });
  carlos = await crearUsuario(db, { usuario: 'carlos', rol: 'conductor', busetaId: 1 });
  servidor = await iniciarServidor(crearApp({ db }));
});

after(() => servidor.cerrar());

const pedir = (metodo, ruta, quien, cuerpo) => servidor.pedir(metodo, `/api/producido${ruta}`, quien?.cookie, cuerpo);

test('solo el admin registra la liquidación', async () => {
  assert.equal((await pedir('PUT', '/1/liquidacion', carlos, AGOSTO)).status, 403);
  assert.equal((await pedir('PUT', '/1/liquidacion', null, AGOSTO)).status, 401);
});

test('el neto a pagar tiene que cuadrar con los valores', async () => {
  const { status, cuerpo } = await pedir('PUT', '/1/liquidacion', admin, { ...AGOSTO, netoAPagar: 3000000 });
  assert.equal(status, 400);
  assert.match(cuerpo.campos.netoAPagar, /3\.146\.069/);
});

test('cierra el mes con la liquidación aunque no haya días registrados', async () => {
  const { status, cuerpo } = await pedir('PUT', '/1/liquidacion', admin, AGOSTO);
  assert.equal(status, 200);
  assert.equal(cuerpo.cerrado, true);
  assert.deepEqual(cuerpo.dias, []);
  assert.equal(cuerpo.resumen.bruto, 10427500);
  assert.equal(cuerpo.resumen.conductor, 2553691);
  assert.equal(cuerpo.resumen.prestamos, 306540);
  assert.equal(cuerpo.resumen.neto, 3146069);
  assert.equal(cuerpo.resumen.deLiquidacion, true);
  assert.equal(cuerpo.liquidacion.netoAPagar, 3146069);
  assert.equal(cuerpo.liquidacion.salarioRelevo, 0);
  assert.equal(cuerpo.liquidacion.fecha, '2026-09-23');
});

test('el mes cerrado no se edita', async () => {
  const dia = await pedir('PUT', '/1/2026-08-10', admin, { ingreso: 500000 });
  assert.equal(dia.status, 409);
  const ajuste = await pedir('POST', '/1/ajustes', admin, { anio: 2026, mes: 8, tipo: 'bono', valor: 1000 });
  assert.equal(ajuste.status, 409);
});

test('el conductor ve la liquidación de su buseta en Mi producido', async () => {
  const { cuerpo } = await pedir('GET', '/mio?anio=2026&mes=8', carlos);
  assert.equal(cuerpo.cerrado, true);
  assert.equal(cuerpo.resumen.neto, 3146069);
  assert.equal(cuerpo.liquidacion.totalBruto, 10427500);
});

test('reabrir quita la liquidación; sin liquidación 404', async () => {
  const r = await pedir('DELETE', '/1/liquidacion?anio=2026&mes=8', admin);
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.cerrado, false);
  assert.equal(r.cuerpo.liquidacion, null);
  assert.equal(r.cuerpo.resumen.bruto, 0);
  assert.equal((await pedir('DELETE', '/1/liquidacion?anio=2026&mes=8', admin)).status, 404);
});

test('no reemplaza un cierre hecho por la app', async () => {
  await db.query(
    `INSERT INTO cierre_mensual (buseta_id, anio, mes, bruto, reposicion, empresa, conductor, peajes, salidas,
       mantenimiento, arriendo, acpm, neto, estado, cerrado_por, cerrado_en)
     VALUES (2, 2026, 7, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 'cerrado', $1, now())`,
    [admin.id],
  );
  const r = await pedir('PUT', '/2/liquidacion', admin, { ...AGOSTO, mes: 7 });
  assert.equal(r.status, 409);
  assert.equal((await pedir('DELETE', '/2/liquidacion?anio=2026&mes=7', admin)).status, 404);
});
