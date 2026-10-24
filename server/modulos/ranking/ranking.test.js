import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import { mesActualBogota } from '../../compartido/fecha.js';
import { crearBdPrueba, crearUsuario, iniciarServidor } from '../../compartido/test/helpers.js';

let servidor;
let admin;
let pedro;
let sinBuseta;
let db;

before(async () => {
  db = await crearBdPrueba();
  await db.exec(`
    INSERT INTO buseta (numero_interno, placa) VALUES ('2033', 'SOT112');
    INSERT INTO buseta (numero_interno, placa, tiene_cupo, valor_arriendo) VALUES ('2007', 'TXA235', false, 300000);
    INSERT INTO buseta (numero_interno, placa) VALUES ('2055', 'ASC245');
    INSERT INTO buseta (numero_interno, placa, activo) VALUES ('1999', 'VIE000', false);
    INSERT INTO buseta (numero_interno, placa) VALUES ('2010', 'EMP010');
  `);
  admin = await crearUsuario(db, { usuario: 'admin' });
  pedro = await crearUsuario(db, { usuario: 'pedro', rol: 'conductor', busetaId: 1 });
  sinBuseta = await crearUsuario(db, { usuario: 'nuevo', rol: 'conductor' });
  // [buseta, fecha, producido]. La 2010 empata con la 2007; la 1999 (desactivada) trabajó.
  const dias = [
    [1, '2026-09-01', 600000],
    [1, '2026-09-02', 700000],
    [1, '2026-09-03', 0],
    [2, '2026-09-01', 900000],
    [4, '2026-09-05', 100000],
    [5, '2026-09-01', 900000],
    [1, '2026-08-31', 5000000],
  ];
  for (const [busetaId, fecha, ingreso] of dias) {
    await db.query(
      `INSERT INTO producido_diario (buseta_id, conductor_id, fecha, ingreso, peajes, creado_por)
       VALUES ($1, $2, $3, $4, 1, $2)`,
      [busetaId, admin.id, fecha, ingreso],
    );
  }
  servidor = await iniciarServidor(crearApp({ db }));
});

after(() => servidor.cerrar());

const pedir = (ruta, quien) => servidor.pedir('GET', `/api/ranking${ruta}`, quien?.cookie);

test('sin sesión 401', async () => {
  assert.equal((await pedir('')).status, 401);
});

test('ordena por producido del mes, con días trabajados y puestos (empates comparten)', async () => {
  const { status, cuerpo } = await pedir('?anio=2026&mes=9', admin);
  assert.equal(status, 200);
  assert.deepEqual(
    cuerpo.busetas.map((b) => [b.numeroInterno, b.bruto, b.diasTrabajados, b.puesto]),
    [
      ['2033', 1300000, 2, 1], // el día en 0 no cuenta como trabajado; el 31/08 es de otro mes
      ['2007', 900000, 1, 2],
      ['2010', 900000, 1, 2],
      ['1999', 100000, 1, 4], // desactivada, pero trabajó ese mes
      ['2055', 0, 0, null], // activa sin producido: al final, sin puesto
    ],
  );
});

test('a los conductores solo les llega número, placa, producido y días, y se marca la suya', async () => {
  const { status, cuerpo } = await pedir('?anio=2026&mes=9', pedro);
  assert.equal(status, 200);
  assert.deepEqual(Object.keys(cuerpo.busetas[0]).sort(), [
    'bruto',
    'diasTrabajados',
    'id',
    'liquidacion',
    'numeroInterno',
    'placa',
    'propia',
    'puesto',
  ]);
  assert.deepEqual(cuerpo.busetas.filter((b) => b.propia).map((b) => b.numeroInterno), ['2033']);
  // El admin no tiene buseta propia; un conductor sin buseta tampoco.
  assert.equal((await pedir('?anio=2026&mes=9', admin)).cuerpo.busetas.some((b) => b.propia), false);
  assert.equal((await pedir('?anio=2026&mes=9', sinBuseta)).cuerpo.busetas.some((b) => b.propia), false);
});

test('por defecto el mes actual; mes inválido o sin año 400', async () => {
  const { cuerpo } = await pedir('', admin);
  assert.deepEqual({ anio: cuerpo.anio, mes: cuerpo.mes }, mesActualBogota());
  assert.equal((await pedir('?anio=2026&mes=13', admin)).status, 400);
  assert.equal((await pedir('?mes=9', admin)).status, 400);
});

test('un mes cerrado con la liquidación de la cooperativa usa el bruto del documento', async () => {
  await db.query(
    `INSERT INTO cierre_mensual (buseta_id, anio, mes, bruto, reposicion, empresa, conductor, peajes, salidas,
       mantenimiento, arriendo, acpm, neto, estado, cerrado_por, cerrado_en, origen)
     VALUES (2, 2026, 7, 10427500, 0, 0, 0, 0, 0, 0, 0, 0, 3146069, 'cerrado', $1, now(), 'liquidacion')`,
    [admin.id],
  );
  const { cuerpo } = await pedir('?anio=2026&mes=7', admin);
  assert.deepEqual(
    [cuerpo.busetas[0].numeroInterno, cuerpo.busetas[0].bruto, cuerpo.busetas[0].liquidacion, cuerpo.busetas[0].puesto],
    ['2007', 10427500, true, 1],
  );
});
