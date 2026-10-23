import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import { hoyBogota } from '../../compartido/fecha.js';
import { crearBdPrueba, crearUsuario, iniciarServidor } from '../../compartido/test/helpers.js';

let db;
let servidor;
let admin;
let pedro;
let otro;

// Un mes ya pasado para poder registrar todos sus días.
const ANIO = 2026;
const MES = 9;
const f = (dia) => `${ANIO}-09-${String(dia).padStart(2, '0')}`;

before(async () => {
  db = await crearBdPrueba();
  await db.exec(`
    INSERT INTO buseta (numero_interno, placa) VALUES ('2033', 'ABC123');
    INSERT INTO buseta (numero_interno, placa) VALUES ('2055', 'XYZ789');
    INSERT INTO buseta (numero_interno, placa) VALUES ('2099', 'SIN000');
  `);
  admin = await crearUsuario(db, { usuario: 'admin' });
  pedro = await crearUsuario(db, { usuario: 'pedro', rol: 'conductor', busetaId: 1 });
  otro = await crearUsuario(db, { usuario: 'otro', rol: 'conductor', busetaId: 2 });
  servidor = await iniciarServidor(crearApp({ db }));
});

after(() => servidor.cerrar());

const pedir = (metodo, ruta, quien, cuerpo) => servidor.pedir(metodo, `/api/producido${ruta}`, quien?.cookie, cuerpo);
const DIA = { ingreso: 630000, peajes: 89400, salidas: 38300, acpm: '' };

describe('admin', () => {
  test('registrar un día devuelve el mes con el resumen recalculado', async () => {
    const { status, cuerpo } = await pedir('PUT', `/1/${f(1)}`, admin, DIA);
    assert.equal(status, 200);
    assert.equal(cuerpo.dias.length, 1);
    assert.equal(cuerpo.dias[0].acpm, 0); // vacío = 0
    assert.equal(cuerpo.dias[0].conductorId, pedro.id);
    assert.equal(cuerpo.resumen.bruto, 630000);
    assert.equal(cuerpo.resumen.empresa, 126000);
    assert.equal(cuerpo.valorRelevo, 132000);
    assert.equal(cuerpo.porcentajeEmpresa, 0.2);
    assert.equal(cuerpo.porcentajeReposicion, 0.01);
    assert.equal(cuerpo.buseta.numeroInterno, '2033');
  });

  test('editar el mismo día lo reemplaza (no duplica)', async () => {
    const { cuerpo } = await pedir('PUT', `/1/${f(1)}`, admin, { ...DIA, ingreso: 700000, relevo: true });
    assert.equal(cuerpo.dias.length, 1);
    assert.equal(cuerpo.resumen.bruto, 700000);
    assert.equal(cuerpo.resumen.diasRelevo, 1);
    assert.equal(cuerpo.resumen.relevo, 132000);
  });

  test('dejar el día en cero lo borra', async () => {
    await pedir('PUT', `/1/${f(2)}`, admin, DIA);
    const { cuerpo } = await pedir('PUT', `/1/${f(2)}`, admin, { ingreso: 0, peajes: '', salidas: null, acpm: 0 });
    assert.deepEqual(cuerpo.dias.map((d) => d.fecha), [f(1)]);
  });

  test('consultar el mes', async () => {
    const { status, cuerpo } = await pedir('GET', `?busetaId=1&anio=${ANIO}&mes=${MES}`, admin);
    assert.equal(status, 200);
    assert.equal(cuerpo.cerrado, false);
    assert.equal(cuerpo.dias.length, 1);
  });

  test('validaciones: negativo, decimales, fecha futura o inválida, sin buseta', async () => {
    assert.equal((await pedir('PUT', `/1/${f(3)}`, admin, { ...DIA, peajes: -1 })).status, 400);
    assert.equal((await pedir('PUT', `/1/${f(3)}`, admin, { ...DIA, acpm: 10.5 })).status, 400);
    assert.equal((await pedir('PUT', `/1/2026-02-30`, admin, DIA)).status, 400);
    const manana = new Date(Date.parse(`${hoyBogota()}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const futura = await pedir('PUT', `/1/${manana}`, admin, DIA);
    assert.equal(futura.status, 400);
    assert.match(futura.cuerpo.error, /no han pasado/);
    assert.equal((await pedir('GET', `?anio=${ANIO}&mes=${MES}`, admin)).status, 404);
    assert.equal((await pedir('PUT', `/999/${f(3)}`, admin, DIA)).status, 404);
  });

  test('no se registra producido de una buseta sin conductor', async () => {
    const { status, cuerpo } = await pedir('PUT', `/3/${f(3)}`, admin, DIA);
    assert.equal(status, 400);
    assert.match(cuerpo.error, /conductor/);
  });

  test('bono y préstamos se agregan, restan del neto y se pueden quitar', async () => {
    const r1 = await pedir('POST', '/1/ajustes', admin, { anio: ANIO, mes: MES, tipo: 'prestamo', descripcion: 'Llantas', valor: 200000 });
    assert.equal(r1.status, 201);
    assert.equal(r1.cuerpo.resumen.prestamos, 200000);
    const netoAntes = r1.cuerpo.resumen.neto;

    const r2 = await pedir('POST', '/1/ajustes', admin, { anio: ANIO, mes: MES, tipo: 'bono', valor: 50000 });
    assert.equal(r2.cuerpo.resumen.bono, 50000);
    assert.equal(r2.cuerpo.resumen.neto, netoAntes - 50000);

    const bono = r2.cuerpo.ajustes.find((a) => a.tipo === 'bono');
    const r3 = await pedir('DELETE', `/1/ajustes/${bono.id}`, admin);
    assert.equal(r3.cuerpo.resumen.bono, 0);

    // Un ajuste no se borra desde otra buseta.
    const prestamo = r3.cuerpo.ajustes[0];
    assert.equal((await pedir('DELETE', `/2/ajustes/${prestamo.id}`, admin)).status, 404);

    const malo = await pedir('POST', '/1/ajustes', admin, { anio: ANIO, mes: MES, tipo: 'otro', valor: 0 });
    assert.equal(malo.status, 400);
  });

  test('ACPM a crédito (La Guaca) se guarda aparte y suma al ACPM total', async () => {
    const { cuerpo } = await pedir('PUT', `/1/${f(4)}`, admin, { ...DIA, acpm: 50000, acpmCredito: 80000 });
    const dia = cuerpo.dias.find((d) => d.fecha === f(4));
    assert.equal(dia.acpmCredito, 80000);
    assert.equal(cuerpo.resumen.acpmCredito, 80000);
    assert.equal(cuerpo.resumen.acpmConductor, 50000);
    assert.equal(cuerpo.resumen.acpm, 130000);
    // Un día con solo ACPM a crédito no se considera vacío
    const solo = await pedir('PUT', `/1/${f(6)}`, admin, { acpmCredito: 10000 });
    assert.ok(solo.cuerpo.dias.some((d) => d.fecha === f(6)));
  });

  test('mantenimiento como ajuste del mes', async () => {
    const r = await pedir('POST', '/1/ajustes', admin, { anio: ANIO, mes: MES, tipo: 'mantenimiento', descripcion: 'Frenos', valor: 1000000 });
    assert.equal(r.status, 201);
    assert.equal(r.cuerpo.resumen.mantenimiento, 1000000);
  });

  test('buseta sin cupo: arriendo y fondo fijo', async () => {
    await db.query('UPDATE buseta SET tiene_cupo = false, valor_arriendo = 300000 WHERE id = 2');
    const { cuerpo } = await pedir('GET', `?busetaId=2&anio=${ANIO}&mes=${MES}`, admin);
    assert.equal(cuerpo.resumen.arriendo, 300000);
    assert.equal(cuerpo.resumen.reposicion, 70000);
    assert.equal(cuerpo.resumen.fondoFijo, true);
    assert.equal(cuerpo.fondoFijoArriendo, 70000);
  });

  test('un mes cerrado no se modifica', async () => {
    await db.query(
      `INSERT INTO cierre_mensual (buseta_id, anio, mes, bruto, reposicion, empresa, conductor, peajes, salidas,
         mantenimiento, arriendo, acpm, neto, estado, cerrado_por, cerrado_en)
       VALUES (1, ${ANIO}, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'cerrado', $1, now())`,
      [admin.id],
    );
    const r = await pedir('PUT', `/1/${ANIO}-08-15`, admin, DIA);
    assert.equal(r.status, 409);
    const a = await pedir('POST', '/1/ajustes', admin, { anio: ANIO, mes: 8, tipo: 'bono', valor: 1000 });
    assert.equal(a.status, 409);
  });

  test('tarifas de rutas: listar y actualizar', async () => {
    const { cuerpo } = await pedir('GET', '/rutas', admin);
    const cartago = cuerpo.rutas.find((r) => r.nombre.includes('Cartago'));
    assert.equal(cartago.peajeTrayecto, 21200);
    assert.equal(cartago.salidaIda, 7100);

    const r = await pedir('PUT', `/rutas/${cartago.id}`, admin, { peajeTrayecto: 22000, salidaIda: 7500, salidaRegreso: 0 });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.ruta.peajeTrayecto, 22000);
  });
});

describe('conductor', () => {
  test('ve solo sus días y solo producido, peajes, salidas y ACPM', async () => {
    await pedir('PUT', `/2/${f(5)}`, admin, { ingreso: 999000, peajes: 1, salidas: 1, acpm: 1 });

    const { status, cuerpo } = await pedir('GET', `/mio?anio=${ANIO}&mes=${MES}`, pedro);
    assert.equal(status, 200);
    assert.equal(cuerpo.buseta.numeroInterno, '2033');
    // Sus días (1, 4 y 6 de la buseta 1); nunca el día 5 de la buseta 2.
    assert.deepEqual(cuerpo.dias.map((d) => d.fecha), [f(1), f(4), f(6)]);
    assert.deepEqual(Object.keys(cuerpo.dias[0]).sort(), ['acpm', 'acpmCredito', 'fecha', 'ingreso', 'peajes', 'relevo', 'salidas']);
    assert.equal(cuerpo.totales.ingreso, 700000 + 630000);
    assert.equal(cuerpo.totales.acpmCredito, 80000 + 10000);
    // Nada del resumen financiero
    for (const prohibido of ['resumen', 'ajustes', 'neto', 'empresa']) assert.equal(prohibido in cuerpo, false);
  });

  test('no puede usar las rutas del admin', async () => {
    assert.equal((await pedir('GET', `?busetaId=1&anio=${ANIO}&mes=${MES}`, pedro)).status, 403);
    assert.equal((await pedir('PUT', `/1/${f(6)}`, pedro, DIA)).status, 403);
    assert.equal((await pedir('GET', '/rutas', otro)).status, 403);
  });

  test('el admin no usa la vista del conductor; sin sesión 401', async () => {
    assert.equal((await pedir('GET', `/mio?anio=${ANIO}&mes=${MES}`, admin)).status, 403);
    assert.equal((await pedir('GET', `/mio?anio=${ANIO}&mes=${MES}`)).status, 401);
  });
});
