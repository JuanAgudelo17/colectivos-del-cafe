// Aplica las migraciones reales sobre PGlite (Postgres en WebAssembly) para
// validar el SQL y las restricciones sin necesitar Supabase.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { crearBdPrueba } from '../test/helpers.js';
import { aplicarMigraciones } from './migraciones.js';

let db;

async function rechaza(sql, params, codigo) {
  await assert.rejects(db.query(sql, params), (err) => {
    assert.equal(err.code, codigo, err.message);
    return true;
  });
}

before(async () => {
  db = await crearBdPrueba();
  await db.exec(`
    INSERT INTO buseta (numero_interno, placa) VALUES ('101', 'ABC123');
    INSERT INTO usuario (usuario, nombre, password_hash, rol, buseta_id) VALUES ('pedro', 'Pedro', 'x', 'conductor', 1);
  `);
});

test('es idempotente: la segunda corrida no aplica nada', async () => {
  assert.deepEqual(await aplicarMigraciones(db), []);
});

test('ya no existe la tabla empresa', async () => {
  const { rows } = await db.query(`SELECT to_regclass('empresa') AS tabla`);
  assert.equal(rows[0].tabla, null);
});

test('carga los parámetros semilla', async () => {
  const { rows } = await db.query('SELECT clave, valor::float AS valor FROM parametro ORDER BY clave');
  assert.deepEqual(rows, [
    { clave: 'porcentaje_empresa', valor: 0.2 },
    { clave: 'porcentaje_reposicion', valor: 0.01 },
    { clave: 'sueldo_conductor', valor: 3066000 },
  ]);
});

test('una sola vigencia por parámetro y fecha', async () => {
  await rechaza(
    `INSERT INTO parametro (clave, valor, vigente_desde) VALUES ('sueldo_conductor', 1, '2026-01-01')`,
    [],
    '23505',
  );
});

test('número interno y placa son únicos en la flota', async () => {
  await rechaza(`INSERT INTO buseta (numero_interno, placa) VALUES ('101', 'XYZ789')`, [], '23505');
  await rechaza(`INSERT INTO buseta (numero_interno, placa) VALUES ('102', 'ABC123')`, [], '23505');
});

test('una buseta tiene a lo sumo un conductor', async () => {
  await rechaza(
    `INSERT INTO usuario (usuario, nombre, password_hash, rol, buseta_id) VALUES ('juan2', 'J', 'x', 'conductor', 1)`,
    [],
    '23505',
  );
});

test('no se puede asignar una buseta inexistente', async () => {
  await rechaza(
    `INSERT INTO usuario (usuario, nombre, password_hash, rol, buseta_id) VALUES ('c9', 'C', 'x', 'conductor', 999)`,
    [],
    '23503',
  );
});

test('el admin no puede tener buseta', async () => {
  await db.exec(`INSERT INTO buseta (numero_interno, placa) VALUES ('103', 'GHI789')`);
  await rechaza(
    `INSERT INTO usuario (usuario, nombre, password_hash, rol, buseta_id) VALUES ('adm', 'A', 'x', 'admin', 2)`,
    [],
    '23514',
  );
});

test('usuario es único sin importar mayúsculas', async () => {
  await rechaza(
    `INSERT INTO usuario (usuario, nombre, password_hash, rol) VALUES ('PEDRO', 'P', 'x', 'admin')`,
    [],
    '23505',
  );
});

test('buseta sin cupo exige valor de arriendo y placa en mayúsculas', async () => {
  await rechaza(`INSERT INTO buseta (numero_interno, placa, tiene_cupo) VALUES ('104', 'DEF456', false)`, [], '23514');
  await rechaza(`INSERT INTO buseta (numero_interno, placa) VALUES ('105', 'abc999')`, [], '23514');
});

test('un solo producido por buseta y día; factura con precio > 0', async () => {
  const sql = `INSERT INTO producido_diario (buseta_id, conductor_id, fecha, ingreso, creado_por)
               VALUES (1, 1, '2026-10-01', 500000, 1)`;
  await db.query(sql);
  await rechaza(sql, [], '23505');
  await rechaza(
    `INSERT INTO factura (conductor_id, buseta_id, fecha, descripcion, precio) VALUES (1, 1, '2026-10-01', 'Peaje', 0)`,
    [],
    '23514',
  );
});
