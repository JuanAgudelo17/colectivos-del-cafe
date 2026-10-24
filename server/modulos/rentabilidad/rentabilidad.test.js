import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import { mesActualBogota } from '../../compartido/fecha.js';
import { crearBdPrueba, crearUsuario, iniciarServidor } from '../../compartido/test/helpers.js';
import { acumular, armarAnio } from './calculo.js';

const PARAMETROS = {
  porcentaje_empresa: '0.2000',
  porcentaje_reposicion: '0.0100',
  sueldo_conductor: '3066000.0000',
  valor_relevo: '132000.0000',
  fondo_fijo_arriendo: '70000.0000',
};
const parametrosPorMes = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, PARAMETROS]));
const dia = (busetaId, mes, ingreso) => ({
  busetaId,
  mes,
  ingreso,
  peajes: 0,
  salidas: 0,
  acpm: 0,
  acpmCredito: 0,
  mantenimiento: 0,
  relevo: false,
});

describe('cálculo del año', () => {
  const busetas = [
    { id: 1, tieneCupo: true, valorArriendo: null, activo: true },
    { id: 2, tieneCupo: false, valorArriendo: 300000, activo: false },
    { id: 3, tieneCupo: true, valorArriendo: null, activo: false },
  ];

  test('solo cuenta meses con registro y acumula buseta y flota', () => {
    const r = armarAnio({
      anio: 2025,
      mesActual: { anio: 2026, mes: 10 },
      busetas,
      dias: [dia(1, 3, 5_000_000), dia(1, 3, 5_000_000), dia(2, 3, 8_000_000)],
      ajustes: [{ busetaId: 1, mes: 6, tipo: 'prestamo', valor: 100000 }],
      parametrosPorMes,
    });
    assert.equal(r.ultimoMes, 12);
    // La 3 está desactivada y no trabajó: no aparece. La 2 está desactivada pero sí trabajó.
    assert.deepEqual(r.busetas.map((b) => b.buseta.id), [1, 2]);
    // Junio solo tiene un préstamo: cuenta como mes registrado.
    assert.deepEqual(r.busetas[0].meses.map((m) => m.mes), [3, 6]);
    const marzo = r.busetas[0].meses[0];
    assert.equal(marzo.bruto, 10_000_000);
    // 10.000.000 − 20 % − 1 % − sueldo
    assert.equal(marzo.neto, 10_000_000 - 2_000_000 - 100_000 - 3_066_000);
    assert.equal(marzo.diasTrabajados, 2);

    assert.deepEqual(r.flota.meses.map((m) => [m.mes, m.busetas]), [[3, 2], [6, 1]]);
    assert.equal(r.flota.meses[0].bruto, 18_000_000);
    const suma = r.busetas.reduce((t, b) => t + b.total.neto, 0);
    assert.equal(r.flota.total.neto, suma);
    assert.equal(r.flota.total.bruto, 18_000_000);
  });

  test('el año actual llega hasta el mes en curso; un año futuro no tiene meses', () => {
    const base = { busetas, ajustes: [], parametrosPorMes, mesActual: { anio: 2026, mes: 10 } };
    const actual = armarAnio({ ...base, anio: 2026, dias: [dia(1, 10, 100), dia(1, 11, 100)] });
    assert.equal(actual.ultimoMes, 10);
    assert.deepEqual(actual.busetas[0].meses.map((m) => [m.mes, m.enCurso]), [[10, true]]);
    assert.equal(armarAnio({ ...base, anio: 2027, dias: [] }).ultimoMes, 0);
  });

  test('acumular suma todos los campos y empieza en cero', () => {
    assert.equal(acumular([]).neto, 0);
    assert.equal(acumular([{ ...acumular([]), neto: 5, bruto: 7 }, { ...acumular([]), neto: -2, bruto: 1 }]).neto, 3);
  });
});

describe('GET /api/rentabilidad', () => {
  let db;
  let servidor;
  let admin;
  let conductor;
  const pedir = (ruta, quien) => servidor.pedir('GET', `/api/rentabilidad${ruta}`, quien?.cookie);

  before(async () => {
    db = await crearBdPrueba();
    await db.exec(`
      INSERT INTO buseta (numero_interno, placa) VALUES ('2033', 'ABC123');
      INSERT INTO buseta (numero_interno, placa, tiene_cupo, valor_arriendo) VALUES ('2007', 'TXA235', false, 300000);
      INSERT INTO buseta (numero_interno, placa) VALUES ('2055', 'SIN000');
      INSERT INTO buseta (numero_interno, placa, activo) VALUES ('1999', 'VIE000', false);
    `);
    admin = await crearUsuario(db, { usuario: 'admin' });
    conductor = await crearUsuario(db, { usuario: 'pedro', rol: 'conductor', busetaId: 1 });
    const otro = await crearUsuario(db, { usuario: 'carlos', rol: 'conductor', busetaId: 2 });
    await db.query(
      `INSERT INTO producido_diario (buseta_id, conductor_id, fecha, ingreso, peajes, salidas, acpm, acpm_credito, relevo, creado_por)
       VALUES (1, $1, '2025-03-02', 630000, 89400, 38300, 50000, 0, false, $3),
              (1, $1, '2025-05-10', 700000, 84800, 14200, 0, 80000, true, $3),
              (2, $2, '2025-05-11', 900000, 127200, 21300, 60000, 0, false, $3)`,
      [conductor.id, otro.id, admin.id],
    );
    await db.query(
      `INSERT INTO ajuste_mensual (buseta_id, anio, mes, tipo, descripcion, valor, creado_por)
       VALUES (2, 2025, 5, 'prestamo', 'Llantas', 200000, $1)`,
      [admin.id],
    );
    servidor = await iniciarServidor(crearApp({ db }));
  });

  after(() => servidor.cerrar());

  test('solo el admin: sin sesión 401, conductor 403', async () => {
    assert.equal((await pedir('?anio=2025')).status, 401);
    assert.equal((await pedir('?anio=2025', conductor)).status, 403);
  });

  test('cada buseta mes a mes y la flota', async () => {
    const { status, cuerpo } = await pedir('?anio=2025', admin);
    assert.equal(status, 200);
    assert.equal(cuerpo.anio, 2025);
    // La 1999 está desactivada y no trabajó; la 2055 está activa aunque no tenga datos.
    assert.deepEqual(cuerpo.busetas.map((b) => b.numeroInterno), ['2007', '2033', '2055']);
    const b2033 = cuerpo.busetas.find((b) => b.numeroInterno === '2033');
    assert.equal(b2033.conductor, 'Nombre pedro');
    assert.deepEqual(b2033.meses.map((m) => m.mes), [3, 5]);
    assert.equal(b2033.total.bruto, 1_330_000);
    assert.equal(cuerpo.busetas.find((b) => b.numeroInterno === '2055').meses.length, 0);
    assert.deepEqual(cuerpo.flota.meses.map((m) => [m.mes, m.busetas]), [[3, 1], [5, 2]]);
    assert.equal(cuerpo.flota.total.bruto, 1_330_000 + 900_000);
    assert.equal(cuerpo.flota.total.prestamos, 200_000);
  });

  test('cada mes cuadra con el resumen del producido (misma fórmula)', async () => {
    const { cuerpo } = await pedir('?anio=2025', admin);
    for (const b of cuerpo.busetas) {
      for (const m of b.meses) {
        const producido = await servidor.pedir('GET', `/api/producido?busetaId=${b.id}&anio=2025&mes=${m.mes}`, admin.cookie);
        const { mes: _mes, enCurso: _enCurso, ...resumen } = m;
        assert.deepEqual(resumen, producido.cuerpo.resumen, `${b.numeroInterno} mes ${m.mes}`);
      }
    }
  });

  test('por defecto el año actual; lista los años con datos', async () => {
    const hoy = mesActualBogota();
    const { cuerpo } = await pedir('', admin);
    assert.equal(cuerpo.anio, hoy.anio);
    assert.equal(cuerpo.ultimoMes, hoy.mes);
    assert.equal(cuerpo.anios[0], hoy.anio);
    assert.equal(cuerpo.anios.at(-1), 2025);
    assert.deepEqual(cuerpo.flota.meses, []);
  });

  test('año inválido 400', async () => {
    assert.equal((await pedir('?anio=abc', admin)).status, 400);
    assert.equal((await pedir('?anio=1990', admin)).status, 400);
  });
  test('el conductor ve solo la rentabilidad de su buseta', async () => {
    const { status, cuerpo } = await pedir('/mia?anio=2025', conductor);
    assert.equal(status, 200);
    assert.equal(cuerpo.buseta.numeroInterno, '2033');
    assert.deepEqual(cuerpo.meses.map((m) => m.mes), [3, 5]);
    // Lo mismo que ve el admin de esa buseta, y nada de la flota ni de otras busetas.
    const delAdmin = (await pedir('?anio=2025', admin)).cuerpo.busetas.find((b) => b.numeroInterno === '2033');
    assert.deepEqual(cuerpo.total, delAdmin.total);
    assert.equal(cuerpo.busetas, undefined);
    assert.equal(cuerpo.flota, undefined);
    assert.equal(cuerpo.proyeccion, null); // 2025 no tiene mes en curso
  });

  test('/mia: solo conductores; sin buseta no hay datos', async () => {
    assert.equal((await pedir('/mia')).status, 401);
    assert.equal((await pedir('/mia', admin)).status, 403);
    const nuevo = await crearUsuario(db, { usuario: 'nuevo', rol: 'conductor' });
    assert.equal((await pedir('/mia', nuevo)).cuerpo.buseta, null);
  });
});
