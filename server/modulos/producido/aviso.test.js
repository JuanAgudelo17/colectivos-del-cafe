import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import { crearBdPrueba, crearUsuario, iniciarServidor } from '../../compartido/test/helpers.js';

let servidor;
let admin;
let pedro;
const enviados = [];
const enviador = {
  configurado: true,
  clavePublica: 'clave',
  async enviar(suscripcion, datos) {
    enviados.push(datos);
    return 'enviada';
  },
};

before(async () => {
  const db = await crearBdPrueba();
  await db.exec(`
    INSERT INTO buseta (numero_interno, placa) VALUES ('2033', 'SOT112');
    INSERT INTO buseta (numero_interno, placa) VALUES ('2055', 'ASC245');
  `);
  admin = await crearUsuario(db, { usuario: 'admin' });
  pedro = await crearUsuario(db, { usuario: 'pedro', rol: 'conductor', busetaId: 1 });
  await db.query(
    `INSERT INTO producido_diario (buseta_id, conductor_id, fecha, ingreso, peajes, creado_por)
     VALUES (1, $1, '2026-09-01', 600000, 84800, $2), (1, $1, '2026-09-02', 700000, 84800, $2)`,
    [pedro.id, admin.id],
  );
  await db.query(
    `INSERT INTO suscripcion_push (usuario_id, endpoint, p256dh, auth) VALUES ($1, 'https://push.ejemplo.com/pedro', 'p', 'a')`,
    [pedro.id],
  );
  const app = crearApp({ db });
  app.locals.enviador = enviador;
  servidor = await iniciarServidor(app);
});

after(() => servidor.cerrar());

const avisar = (busetaId, quien, mes = 9) =>
  servidor.pedir('POST', `/api/producido/${busetaId}/avisar`, quien?.cookie, { anio: 2026, mes });

test('el admin le avisa al conductor que ya está su producido (campanita y celular)', async () => {
  const { status, cuerpo } = await avisar(1, admin);
  assert.equal(status, 200);
  assert.deepEqual(cuerpo, { creadas: 1, enviadas: 1, conductor: 'Nombre pedro' });
  assert.equal(enviados[0].titulo, 'Ya está tu producido de septiembre');
  assert.match(enviados[0].cuerpo, /^2 días · Producido \$ 1\.300\.000 · Total neto/);
  assert.equal(enviados[0].url, '/conductor/mi-producido?anio=2026&mes=9');

  const campanita = (await servidor.pedir('GET', '/api/notificaciones', pedro.cookie)).cuerpo;
  assert.equal(campanita.noLeidas, 1);
  assert.equal(campanita.notificaciones[0].titulo, 'Ya está tu producido de septiembre');
  // Se puede volver a avisar (por ejemplo, después de corregir algo).
  assert.equal((await avisar(1, admin)).cuerpo.creadas, 1);
});

test('solo el admin; sin conductor o sin producido no se avisa', async () => {
  assert.equal((await avisar(1, pedro)).status, 403);
  const sinConductor = await avisar(2, admin);
  assert.equal(sinConductor.status, 400);
  assert.match(sinConductor.cuerpo.error, /conductor/);
  const sinProducido = await avisar(1, admin, 8);
  assert.equal(sinProducido.status, 400);
  assert.match(sinProducido.cuerpo.error, /Todavía no hay producido/);
});
