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

// ---- Cierre con la planilla (botón "Cerrar el mes") ------------------------------

test('cerrar el mes: solo el admin, con el mes terminado y con producido', async () => {
  assert.equal((await pedir('POST', '/2/cierre', carlos, { anio: 2026, mes: 7 })).status, 403);
  const futuro = await pedir('POST', '/2/cierre', admin, { anio: 2099, mes: 1 });
  assert.equal(futuro.status, 400);
  assert.match(futuro.cuerpo.error, /cuando termine/);
  const vacio = await pedir('POST', '/2/cierre', admin, { anio: 2026, mes: 6 });
  assert.equal(vacio.status, 400);
  assert.match(vacio.cuerpo.error, /No hay producido/);
});

test('cerrar el mes guarda la planilla y lo bloquea', async () => {
  await crearUsuario(db, { usuario: 'nico', rol: 'conductor', busetaId: 2 });
  await pedir('PUT', '/2/2026-07-01', admin, { ingreso: 500000, peajes: 42400, acpm: 50000, acpmCredito: 30000 });
  const abierto = (await pedir('PUT', '/2/2026-07-02', admin, { ingreso: 400000, relevo: true })).cuerpo;
  assert.equal(abierto.mesTerminado, true);

  const { status, cuerpo } = await pedir('POST', '/2/cierre', admin, { anio: 2026, mes: 7 });
  assert.equal(status, 201);
  assert.equal(cuerpo.cerrado, true);
  assert.equal(cuerpo.cierre.origen, 'calculado');
  // El resumen guardado es el mismo que se veía abierto (incluido el detalle del ACPM).
  for (const campo of ['bruto', 'empresa', 'reposicion', 'conductor', 'peajes', 'acpm', 'relevo', 'neto']) {
    assert.equal(cuerpo.resumen[campo], abierto.resumen[campo], campo);
  }
  assert.equal(cuerpo.resumen.acpmCredito, 30000);
  assert.equal(cuerpo.resumen.acpmConductor, 50000);
  assert.equal(cuerpo.resumen.deLiquidacion, false);
  assert.equal(cuerpo.conciliacion, null);

  assert.equal((await pedir('PUT', '/2/2026-07-03', admin, { ingreso: 1 })).status, 409);
  assert.equal((await pedir('POST', '/2/cierre', admin, { anio: 2026, mes: 7 })).status, 409);
});

test('la liquidación reemplaza el cierre de la planilla y se concilia con los días', async () => {
  const { status, cuerpo } = await pedir('PUT', '/2/liquidacion', admin, {
    ...AGOSTO,
    mes: 7,
    totalBruto: 950000,
    administracion: 190000,
    fondoReposicion: 9500,
    salidas: 0,
    peajes: 42400,
    prestamos: 0,
    salarioConductor: 0,
    prestacionesConductor: 0,
    seguridadSocialConductor: 0,
    netoAPagar: 708100,
  });
  assert.equal(status, 200);
  assert.equal(cuerpo.cierre.origen, 'liquidacion');
  assert.equal(cuerpo.resumen.neto, 708100);

  const linea = (clave) => cuerpo.conciliacion.lineas.find((l) => l.clave === clave);
  assert.deepEqual(linea('bruto'), { clave: 'bruto', nombre: 'Producido', planilla: 900000, cooperativa: 950000, diferencia: 50000 });
  assert.equal(linea('peajes').diferencia, 0);
  assert.equal(linea('acpm').planilla, 80000);
  assert.equal(linea('acpm').cooperativa, 0);
  assert.equal(cuerpo.conciliacion.neto.cooperativa, 708100);
  assert.equal(cuerpo.conciliacion.cuadra, false);

  // Ya no es un cierre de la planilla: se reabre quitando la liquidación.
  assert.equal((await pedir('DELETE', '/2/cierre?anio=2026&mes=7', admin)).status, 404);
  const reabierto = await pedir('DELETE', '/2/liquidacion?anio=2026&mes=7', admin);
  assert.equal(reabierto.cuerpo.cerrado, false);
  assert.equal(reabierto.cuerpo.resumen.bruto, 900000);
});

test('reabrir un mes cerrado con la planilla', async () => {
  assert.equal((await pedir('POST', '/2/cierre', admin, { anio: 2026, mes: 7 })).status, 201);
  assert.equal((await pedir('DELETE', '/2/cierre?anio=2026&mes=7', carlos)).status, 403);
  const r = await pedir('DELETE', '/2/cierre?anio=2026&mes=7', admin);
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.cerrado, false);
  assert.equal(r.cuerpo.cierre, null);
  assert.equal((await pedir('PUT', '/2/2026-07-03', admin, { ingreso: 1000 })).status, 200);
});
