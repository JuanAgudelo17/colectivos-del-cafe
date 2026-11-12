import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import { crearBdPrueba, crearUsuario, iniciarServidor } from '../../compartido/test/helpers.js';

let db;
let servidor;
let admin;
let carlos;

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
// Basada en una planilla real de la 2007 (Pereira → Cartago), en octubre para poder cerrar el mes.
const IDA = { fecha: '2026-10-05', rutaId: 1, sentido: 'ida', consecutivo: 'P00000000366926', valor: 149500, peaje: 21200, salida: 7100 };
const REGRESO = { fecha: '2026-10-05', rutaId: 1, sentido: 'regreso', valor: 132000, peaje: 21200, salida: 0 };
const dia = (cuerpo, fecha) => cuerpo.mes.dias.find((d) => d.fecha === fecha);

test('solo el admin digita planillas', async () => {
  assert.equal((await pedir('POST', '/1/planillas', carlos, IDA)).status, 403);
  assert.equal((await pedir('POST', '/1/planillas', null, IDA)).status, 401);
});

test('se valida lo mínimo: fecha y valor', async () => {
  const r = await pedir('POST', '/1/planillas', admin, { fecha: '2099-01-01', valor: 0 });
  assert.equal(r.status, 400);
  assert.ok(r.cuerpo.campos.fecha && r.cuerpo.campos.valor);
});

test('cada planilla suma al día: producido, peajes y salidas', async () => {
  const r = await pedir('POST', '/1/planillas', admin, IDA);
  assert.equal(r.status, 201);
  assert.equal(r.cuerpo.planillas.length, 1);
  assert.equal(r.cuerpo.planillas[0].consecutivo, '366926', 'solo los dígitos, sin ceros a la izquierda');
  assert.equal(r.cuerpo.planillas[0].ruta, 'Pereira – Cartago');
  assert.deepEqual(
    (({ ingreso, peajes, salidas }) => ({ ingreso, peajes, salidas }))(dia(r.cuerpo, '2026-10-05')),
    { ingreso: 149500, peajes: 21200, salidas: 7100 },
  );

  const vuelta = await pedir('POST', '/1/planillas', admin, REGRESO);
  const d = dia(vuelta.cuerpo, '2026-10-05');
  assert.equal(d.ingreso, 281500);
  assert.equal(d.peajes, 42400);
  assert.equal(d.salidas, 7100);
  assert.equal(vuelta.cuerpo.mes.resumen.bruto, 281500);
});

test('no se digita dos veces la misma planilla (aunque se escriba distinto)', async () => {
  const r = await pedir('POST', '/1/planillas', admin, { ...IDA, fecha: '2026-10-06', consecutivo: '366926' });
  assert.equal(r.status, 409);
  assert.match(r.cuerpo.campos.consecutivo, /366926 ya está registrada \(el 05\/10\)/);
  // En otra buseta el mismo número no choca.
  assert.equal((await pedir('POST', '/2/planillas', admin, IDA)).status, 400, 'la 2033 no tiene conductor');
});

test('lo que no viene de las planillas (ACPM, relevo) se conserva', async () => {
  const mes = (await pedir('GET', '/?busetaId=1&anio=2026&mes=10', admin)).cuerpo;
  const actual = mes.dias.find((d) => d.fecha === '2026-10-05');
  await pedir('PUT', '/1/2026-10-05', admin, { ...actual, acpm: 90000, relevo: true });
  const r = await pedir('POST', '/1/planillas', admin, { ...REGRESO, sentido: 'ida', valor: 100000, salida: 7100 });
  const d = dia(r.cuerpo, '2026-10-05');
  assert.equal(d.ingreso, 381500);
  assert.equal(d.acpm, 90000);
  assert.equal(d.relevo, true);
});

test('quitar una planilla resta; sin planillas ni nada más el día se borra', async () => {
  const { cuerpo } = await pedir('GET', '/1/planillas?anio=2026&mes=10', admin);
  assert.equal(cuerpo.planillas.length, 3);
  let r = await pedir('DELETE', `/1/planillas/${cuerpo.planillas[2].id}`, admin);
  assert.equal(r.status, 200);
  assert.equal(dia(r.cuerpo, '2026-10-05').ingreso, 281500);

  // Un día solo con planillas (sin ACPM ni relevo) desaparece al quitarlas.
  r = await pedir('POST', '/1/planillas', admin, { ...REGRESO, fecha: '2026-10-07' });
  const id = r.cuerpo.planillas.find((p) => p.fecha === '2026-10-07').id;
  r = await pedir('DELETE', `/1/planillas/${id}`, admin);
  assert.equal(dia(r.cuerpo, '2026-10-07'), undefined);
  assert.equal((await pedir('DELETE', `/2/planillas/${cuerpo.planillas[0].id}`, admin)).status, 404, 'de otra buseta');
});

test('con el mes cerrado no se agregan ni se quitan planillas', async () => {
  await db.query(
    `INSERT INTO cierre_mensual (buseta_id, anio, mes, bruto, reposicion, empresa, conductor, peajes, salidas,
       mantenimiento, arriendo, acpm, neto, estado, cerrado_por, cerrado_en)
     VALUES (1, 2026, 10, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 'cerrado', $1, now())`,
    [admin.id],
  );
  assert.equal((await pedir('POST', '/1/planillas', admin, { ...REGRESO, fecha: '2026-10-08' })).status, 409);
  const { cuerpo } = await pedir('GET', '/1/planillas?anio=2026&mes=10', admin);
  assert.equal((await pedir('DELETE', `/1/planillas/${cuerpo.planillas[0].id}`, admin)).status, 409);
});
