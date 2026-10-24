import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import { crearBdPrueba, crearUsuario, iniciarServidor } from '../../compartido/test/helpers.js';

let servidor;
let admin;
let conductor;

before(async () => {
  const db = await crearBdPrueba();
  await db.exec(`INSERT INTO buseta (numero_interno, placa) VALUES ('101', 'ABC123'), ('102', 'DEF456')`);
  admin = await crearUsuario(db, { usuario: 'admin' });
  conductor = await crearUsuario(db, { usuario: 'pedro', rol: 'conductor', busetaId: 1 });
  await db.query(`INSERT INTO solicitud_recuperacion (usuario_id, ip) VALUES ($1, '1.2.3.4')`, [conductor.id]);
  servidor = await iniciarServidor(crearApp({ db }));
});

after(() => servidor.cerrar());

const pedir = (quien) => servidor.pedir('GET', '/api/dashboard', quien?.cookie);

test('el admin recibe en una sola petición lo mismo que las cuatro rutas por separado', async () => {
  const { status, cuerpo } = await pedir(admin);
  assert.equal(status, 200);

  const separado = await Promise.all(
    ['/api/busetas', '/api/conductores', '/api/mantenimiento', '/api/auth/solicitudes'].map(
      async (ruta) => (await servidor.pedir('GET', ruta, admin.cookie)).cuerpo,
    ),
  );
  assert.deepEqual(cuerpo, {
    busetas: separado[0].busetas,
    conductores: separado[1].conductores,
    mantenimiento: separado[2].busetas,
    solicitudes: separado[3].solicitudes,
  });
  assert.equal(cuerpo.busetas.length, 2);
  assert.equal(cuerpo.solicitudes.length, 1);
});

test('el conductor y quien no tiene sesión no pueden verlo', async () => {
  assert.equal((await pedir(conductor)).status, 403);
  assert.equal((await pedir(null)).status, 401);
});
