// Aplica las migraciones reales sobre PGlite (Postgres en WebAssembly) para
// validar el SQL y las restricciones sin necesitar Supabase.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { aplicarMigraciones } from '../db/migraciones.js';

let db;

async function rechaza(sql, params, codigo) {
  await assert.rejects(db.query(sql, params), (err) => {
    assert.equal(err.code, codigo, err.message);
    return true;
  });
}

before(async () => {
  db = new PGlite();
  await aplicarMigraciones(db);

  await db.exec(`
    INSERT INTO empresa (nombre) VALUES ('Otra empresa');
    INSERT INTO buseta (empresa_id, numero_interno, placa) VALUES (1, '101', 'ABC123');
    INSERT INTO buseta (empresa_id, numero_interno, placa) VALUES (2, '201', 'XYZ789');
  `);
});

test('es idempotente: la segunda corrida no aplica nada', async () => {
  assert.deepEqual(await aplicarMigraciones(db), []);
});

test('carga la empresa y los parámetros semilla', async () => {
  const { rows } = await db.query('SELECT clave, valor::float AS valor FROM parametro ORDER BY clave');
  assert.deepEqual(rows, [
    { clave: 'porcentaje_empresa', valor: 0.2 },
    { clave: 'porcentaje_reposicion', valor: 0.01 },
    { clave: 'sueldo_conductor', valor: 3066000 },
  ]);
});

test('conductor sin empresa es rechazado', async () => {
  await rechaza(
    `INSERT INTO usuario (usuario, nombre, password_hash, rol) VALUES ('c1', 'C', 'x', 'conductor')`,
    [],
    '23514',
  );
});

test('conductor no puede tener buseta de otra empresa', async () => {
  // buseta 2 es de la empresa 2
  await rechaza(
    `INSERT INTO usuario (empresa_id, usuario, nombre, password_hash, rol, buseta_id)
     VALUES (1, 'c2', 'C', 'x', 'conductor', 2)`,
    [],
    '23503',
  );
});

test('usuario es único sin importar mayúsculas', async () => {
  await db.query(`INSERT INTO usuario (usuario, nombre, password_hash, rol) VALUES ('Juan', 'J', 'x', 'admin')`);
  await rechaza(
    `INSERT INTO usuario (usuario, nombre, password_hash, rol) VALUES ('juan', 'J', 'x', 'admin')`,
    [],
    '23505',
  );
});

test('buseta sin cupo exige valor de arriendo', async () => {
  await rechaza(
    `INSERT INTO buseta (empresa_id, numero_interno, placa, tiene_cupo) VALUES (1, '102', 'DEF456', false)`,
    [],
    '23514',
  );
});

test('placa debe ir en mayúsculas', async () => {
  await rechaza(
    `INSERT INTO buseta (empresa_id, numero_interno, placa) VALUES (1, '103', 'abc999')`,
    [],
    '23514',
  );
});

test('un solo producido por buseta y día', async () => {
  const { rows } = await db.query(
    `INSERT INTO usuario (empresa_id, usuario, nombre, password_hash, rol, buseta_id)
     VALUES (1, 'pedro', 'Pedro', 'x', 'conductor', 1) RETURNING id`,
  );
  const conductor = rows[0].id;
  const sql = `INSERT INTO producido_diario (buseta_id, conductor_id, fecha, ingreso, creado_por)
               VALUES (1, $1, '2026-10-01', 500000, $1)`;
  await db.query(sql, [conductor]);
  await rechaza(sql, [conductor], '23505');
});

test('factura con precio cero es rechazada', async () => {
  await rechaza(
    `INSERT INTO factura (conductor_id, buseta_id, fecha, descripcion, precio)
     SELECT id, 1, '2026-10-01', 'Peaje', 0 FROM usuario WHERE usuario = 'pedro'`,
    [],
    '23514',
  );
});
