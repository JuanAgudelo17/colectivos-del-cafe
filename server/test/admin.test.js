// CRUD del admin: empresas, busetas, conductores y documentos, con sus permisos.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../app.js';
import { hoyBogota } from '../lib/fecha.js';
import { firmarToken } from '../lib/sesion.js';
import { crearBdPrueba, hashPrueba, iniciarServidor } from './helpers.js';

let db;
let servidor;
const cookies = {};

before(async () => {
  db = await crearBdPrueba();
  const hash = await hashPrueba('x');
  // Empresa 1 viene de la semilla.
  await db.exec(`
    INSERT INTO empresa (nombre) VALUES ('Empresa Dos');
    INSERT INTO buseta (empresa_id, numero_interno, placa) VALUES (2, '900', 'ZZZ999');
  `);
  const { rows } = await db.query(
    `INSERT INTO usuario (empresa_id, usuario, nombre, password_hash, rol) VALUES
       (NULL, 'global',    'Admin Global',  $1, 'admin'),
       (1,    'admin1',    'Admin Empresa', $1, 'admin'),
       (1,    'conductor', 'Conductor',     $1, 'conductor')
     RETURNING id, usuario`,
    [hash],
  );
  for (const { id, usuario } of rows) cookies[usuario] = `sesion=${await firmarToken(id)}`;
  servidor = await iniciarServidor(crearApp({ db }));
});

after(() => servidor.cerrar());

async function pedir(metodo, ruta, quien, cuerpo) {
  const res = await fetch(`${servidor.base}/api${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(quien && { Cookie: cookies[quien] }) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  return { status: res.status, cuerpo: await res.json().catch(() => null) };
}

const login = (usuario, password) => pedir('POST', '/auth/login', null, { usuario, password });

// Suma días a hoy (Bogotá) → 'YYYY-MM-DD'.
function enDias(n) {
  const d = new Date(`${hoyBogota()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe('permisos generales', () => {
  test('sin sesión → 401; conductor → 403 en todo el CRUD', async () => {
    for (const ruta of ['/empresas', '/busetas', '/conductores']) {
      assert.equal((await pedir('GET', ruta)).status, 401);
      assert.equal((await pedir('GET', ruta, 'conductor')).status, 403);
    }
  });
});

describe('empresas', () => {
  test('el admin global crea empresas; el de empresa no', async () => {
    const r = await pedir('POST', '/empresas', 'global', { nombre: '  Transportes Tres ', nit: '900.123.456-7' });
    assert.equal(r.status, 201);
    assert.equal(r.cuerpo.empresa.nombre, 'Transportes Tres');
    assert.equal(r.cuerpo.empresa.nit, '900123456-7');

    assert.equal((await pedir('POST', '/empresas', 'admin1', { nombre: 'X' })).status, 403);
  });

  test('NIT duplicado → 409 con el campo señalado', async () => {
    const r = await pedir('POST', '/empresas', 'global', { nombre: 'Copia', nit: '900123456-7' });
    assert.equal(r.status, 409);
    assert.ok(r.cuerpo.campos.nit);
  });

  test('el admin de empresa solo ve y edita la suya', async () => {
    const lista = await pedir('GET', '/empresas', 'admin1');
    assert.deepEqual(lista.cuerpo.empresas.map((e) => e.id), [1]);

    const ajena = await pedir('PUT', '/empresas/2', 'admin1', { nombre: 'Hack', nit: null, activo: true });
    assert.equal(ajena.status, 403);
  });

  test('el global ve todas', async () => {
    const lista = await pedir('GET', '/empresas', 'global');
    assert.equal(lista.cuerpo.empresas.length, 3);
  });
});

describe('busetas', () => {
  let busetaId;

  test('crear normaliza la placa y calcula el estado de documentos', async () => {
    const r = await pedir('POST', '/busetas', 'admin1', {
      empresaId: 1,
      numeroInterno: '101',
      placa: 'abc-123',
      modelo: 'NPR 2020',
      tieneCupo: true,
      valorArriendo: 500000, // se ignora: tiene cupo
      fechaSoat: enDias(10),
      fechaTecnomecanica: enDias(-1),
    });
    assert.equal(r.status, 201);
    const b = r.cuerpo.buseta;
    busetaId = b.id;
    assert.equal(b.placa, 'ABC123');
    assert.equal(b.valorArriendo, null);
    assert.equal(b.documentos.soat.estado, 'por_vencer');
    assert.equal(b.documentos.soat.dias, 10);
    assert.equal(b.documentos.tecnomecanica.estado, 'vencido');
  });

  test('sin cupo exige arriendo', async () => {
    const r = await pedir('POST', '/busetas', 'admin1', {
      empresaId: 1, numeroInterno: '102', placa: 'DEF456', tieneCupo: false,
    });
    assert.equal(r.status, 400);
    assert.match(r.cuerpo.campos.valorArriendo, /arriendo/);
  });

  test('placa duplicada → 409; placa inválida → 400', async () => {
    const base = { empresaId: 1, numeroInterno: '103', tieneCupo: true };
    const dup = await pedir('POST', '/busetas', 'admin1', { ...base, placa: 'ABC123' });
    assert.equal(dup.status, 409);
    assert.ok(dup.cuerpo.campos.placa);

    const mala = await pedir('POST', '/busetas', 'admin1', { ...base, placa: 'A!' });
    assert.equal(mala.status, 400);
    assert.ok(mala.cuerpo.campos.placa);
  });

  test('admin de empresa no crea, ve ni lista busetas de otra empresa', async () => {
    const crear = await pedir('POST', '/busetas', 'admin1', {
      empresaId: 2, numeroInterno: '1', placa: 'QQQ111', tieneCupo: true,
    });
    assert.equal(crear.status, 403);
    assert.equal((await pedir('GET', '/busetas/1', 'admin1')).status, 403); // ZZZ999, empresa 2
    assert.equal((await pedir('GET', '/busetas?empresaId=2', 'admin1')).status, 403);

    const lista = await pedir('GET', '/busetas', 'admin1');
    assert.ok(lista.cuerpo.busetas.every((b) => b.empresaId === 1));
  });

  test('editar actualiza datos y fechas de documentos', async () => {
    const r = await pedir('PUT', `/busetas/${busetaId}`, 'admin1', {
      numeroInterno: '101', placa: 'ABC123', modelo: null, tieneCupo: false, valorArriendo: 1200000,
      fechaSoat: enDias(200), fechaTecnomecanica: '', activo: true,
    });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.buseta.valorArriendo, 1200000);
    assert.equal(r.cuerpo.buseta.documentos.soat.estado, 'vigente');
    assert.equal(r.cuerpo.buseta.documentos.tecnomecanica.estado, 'sin_fecha');
  });

  test('id inexistente o inválido → 404', async () => {
    assert.equal((await pedir('GET', '/busetas/9999', 'global')).status, 404);
    assert.equal((await pedir('GET', '/busetas/abc', 'global')).status, 404);
  });
});

describe('conductores', () => {
  let conductor;
  let password;

  test('crear devuelve la contraseña una vez y con ella se puede entrar', async () => {
    const r = await pedir('POST', '/conductores', 'admin1', {
      empresaId: 1, usuario: ' Carlos.R ', nombre: 'Carlos Ruiz', cedula: '1.088.123.456', telefono: '310 555 1234',
      busetaId: null,
    });
    assert.equal(r.status, 201);
    ({ conductor, password } = r.cuerpo);
    assert.equal(conductor.usuario, 'carlos.r');
    assert.equal(conductor.cedula, '1088123456');
    assert.equal(conductor.telefono, '3105551234');
    assert.match(password, /^[a-z2-9]{10}$/);
    assert.equal(JSON.stringify(r.cuerpo).includes('hash'), false);

    const entrar = await login('carlos.r', password);
    assert.equal(entrar.status, 200);
    assert.equal(entrar.cuerpo.usuario.rol, 'conductor');
  });

  test('usuario duplicado → 409', async () => {
    const r = await pedir('POST', '/conductores', 'admin1', { empresaId: 1, usuario: 'CARLOS.R', nombre: 'Otro' });
    assert.equal(r.status, 409);
    assert.ok(r.cuerpo.campos.usuario);
  });

  test('no se puede asignar una buseta de otra empresa', async () => {
    const r = await pedir('PUT', `/conductores/${conductor.id}`, 'admin1', { ...conductor, busetaId: 1 });
    assert.equal(r.status, 400);
    assert.ok(r.cuerpo.campos.busetaId);
  });

  test('asignar buseta y no repetirla en otro conductor', async () => {
    const { cuerpo } = await pedir('GET', '/busetas?empresaId=1', 'admin1');
    const abc = cuerpo.busetas.find((b) => b.placa === 'ABC123');

    const asignar = await pedir('PUT', `/conductores/${conductor.id}`, 'admin1', { ...conductor, busetaId: abc.id });
    assert.equal(asignar.status, 200);
    assert.equal(asignar.cuerpo.conductor.busetaPlaca, 'ABC123');

    const otro = await pedir('POST', '/conductores', 'admin1', {
      empresaId: 1, usuario: 'otro', nombre: 'Otro', busetaId: abc.id,
    });
    assert.equal(otro.status, 409);
    assert.match(otro.cuerpo.campos.busetaId, /otro conductor/);
  });

  test('restablecer contraseña invalida la anterior', async () => {
    const r = await pedir('POST', `/conductores/${conductor.id}/restablecer-password`, 'admin1');
    assert.equal(r.status, 200);
    assert.notEqual(r.cuerpo.password, password);
    assert.equal((await login('carlos.r', password)).status, 401);
    assert.equal((await login('carlos.r', r.cuerpo.password)).status, 200);
    password = r.cuerpo.password;
  });

  test('desactivar impide entrar', async () => {
    const { cuerpo } = await pedir('GET', `/conductores/${conductor.id}`, 'admin1');
    const r = await pedir('PUT', `/conductores/${conductor.id}`, 'admin1', { ...cuerpo.conductor, activo: false });
    assert.equal(r.status, 200);
    assert.equal((await login('carlos.r', password)).status, 401);
  });

  test('admin de empresa no ve conductores de otra', async () => {
    const r = await pedir('GET', '/conductores', 'admin1');
    assert.ok(r.cuerpo.conductores.every((c) => c.empresaId === 1));
    assert.equal((await pedir('GET', '/conductores?empresaId=2', 'admin1')).status, 403);
  });
});
