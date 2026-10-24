import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../app.js';
import { hoyBogota } from '../../compartido/fecha.js';
import { crearBdPrueba, crearUsuario, enDias, iniciarServidor } from '../../compartido/test/helpers.js';
import { revisarRecordatorios } from './revisar.js';

const hoy = hoyBogota();

// Enviador falso: guarda lo enviado; un endpoint con "vencido" responde como celular dado de baja.
function enviadorFalso() {
  const enviados = [];
  return {
    configurado: true,
    clavePublica: 'clave-publica-de-prueba',
    enviados,
    async enviar(suscripcion, datos) {
      if (suscripcion.endpoint.includes('vencido')) return 'vencida';
      enviados.push({ endpoint: suscripcion.endpoint, ...datos });
      return 'enviada';
    },
  };
}

let db;
let servidor;
let enviador;
let admin;
let pedro;
let carlos;

before(async () => {
  db = await crearBdPrueba();
  await db.exec(`
    INSERT INTO buseta (numero_interno, placa) VALUES ('2033', 'SOT112');
    INSERT INTO buseta (numero_interno, placa) VALUES ('2007', 'TXA235');
  `);
  // SOAT de la 2033 a 7 días; tecnomecánica vencida. La 2007 al día.
  await db.query(
    'INSERT INTO documento_buseta (buseta_id, fecha_soat, fecha_tecnomecanica) VALUES (1, $1, $2), (2, $3, $3)',
    [enDias(7, hoy), enDias(-2, hoy), enDias(300, hoy)],
  );
  admin = await crearUsuario(db, { usuario: 'admin' });
  pedro = await crearUsuario(db, { usuario: 'pedro', rol: 'conductor', busetaId: 1 });
  carlos = await crearUsuario(db, { usuario: 'carlos', rol: 'conductor', busetaId: 2 });
  // Kilometraje reciente en las dos busetas: así solo salen los avisos de documentos.
  await db.query(
    `INSERT INTO lectura_kilometraje (buseta_id, fecha, kilometraje, registrado_por)
     VALUES (1, $1, 1000, $2), (2, $1, 2000, $2)`,
    [hoy, admin.id],
  );
  enviador = enviadorFalso();
  const app = crearApp({ db });
  app.locals.enviador = enviador;
  servidor = await iniciarServidor(app);
});

after(() => servidor.cerrar());

const pedir = (metodo, ruta, quien, cuerpo) =>
  servidor.pedir(metodo, `/api/notificaciones${ruta}`, quien?.cookie, cuerpo);
const SUSCRIPCION = (nombre) => ({
  endpoint: `https://push.ejemplo.com/${nombre}`,
  keys: { p256dh: 'clave-p256dh', auth: 'clave-auth' },
});

describe('suscripciones', () => {
  test('sin sesión 401', async () => {
    assert.equal((await pedir('GET', '')).status, 401);
  });

  test('cada usuario suscribe su celular; endpoint inválido 400', async () => {
    assert.equal((await pedir('POST', '/suscripcion', pedro, SUSCRIPCION('pedro'))).status, 201);
    assert.equal((await pedir('POST', '/suscripcion', admin, SUSCRIPCION('admin'))).status, 201);
    assert.equal((await pedir('POST', '/suscripcion', admin, SUSCRIPCION('admin-vencido'))).status, 201);
    const mala = await pedir('POST', '/suscripcion', pedro, { endpoint: 'http://no-seguro', keys: { p256dh: 'a', auth: 'b' } });
    assert.equal(mala.status, 400);
  });

  test('aviso de prueba solo a los celulares propios', async () => {
    const { status, cuerpo } = await pedir('POST', '/prueba', pedro);
    assert.equal(status, 200);
    assert.equal(cuerpo.enviadas, 1);
    assert.equal(enviador.enviados.at(-1).endpoint, 'https://push.ejemplo.com/pedro');
    assert.equal(enviador.enviados.at(-1).url, '/conductor');
    // Carlos no ha activado nada
    assert.equal((await pedir('POST', '/prueba', carlos)).status, 400);
  });

  test('GET devuelve la clave pública para suscribirse', async () => {
    const { cuerpo } = await pedir('GET', '', pedro);
    assert.deepEqual(cuerpo.push, { disponible: true, clavePublica: 'clave-publica-de-prueba' });
  });
});

describe('revisión diaria', () => {
  test('crea los avisos, los manda al celular y no los repite', async () => {
    enviador.enviados.length = 0;
    const primera = await revisarRecordatorios(db, { enviador, hoy });
    // SOAT (7 días) y tecnomecánica (vencida) de la 2033: a Pedro y al admin = 4.
    assert.equal(primera.creadas, 4);
    // Pedro 2; admin 2 (el celular "vencido" se borra y no cuenta).
    assert.equal(primera.enviadas, 4);
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM suscripcion_push WHERE endpoint LIKE '%vencido%'`);
    assert.equal(rows[0].n, 0);

    const segunda = await revisarRecordatorios(db, { enviador, hoy });
    assert.deepEqual(segunda, { creadas: 0, enviadas: 0 });
  });

  test('cada uno ve solo sus avisos, con los no leídos', async () => {
    const dePedro = (await pedir('GET', '', pedro)).cuerpo;
    assert.equal(dePedro.noLeidas, 2);
    assert.deepEqual(dePedro.notificaciones.map((n) => n.url), ['/conductor/documentos', '/conductor/documentos']);
    const deCarlos = (await pedir('GET', '', carlos)).cuerpo;
    assert.deepEqual(deCarlos.notificaciones, []);
  });

  test('marcar como leídas una o todas (solo las propias)', async () => {
    const dePedro = (await pedir('GET', '', pedro)).cuerpo.notificaciones;
    const delAdmin = (await pedir('GET', '', admin)).cuerpo.notificaciones;
    // Pedro intenta marcar una del admin: no cambia nada del admin.
    await pedir('POST', '/leidas', pedro, { ids: [delAdmin[0].id] });
    assert.equal((await pedir('GET', '', admin)).cuerpo.noLeidas, 2);

    const una = await pedir('POST', '/leidas', pedro, { ids: [dePedro[0].id] });
    assert.equal(una.cuerpo.noLeidas, 1);
    const todas = await pedir('POST', '/leidas', pedro, {});
    assert.equal(todas.cuerpo.noLeidas, 0);
  });

  test('con más de 3 avisos nuevos, al celular llega uno que los resume', async () => {
    enviador.enviados.length = 0;
    await db.query(
      `UPDATE documento_buseta SET fecha_tarjeta_operacion = $1, fecha_poliza_rcc = $1, fecha_poliza_rce = $1, fecha_extintor = $1
        WHERE buseta_id = 1`,
      [enDias(20, hoy)],
    );
    const r = await revisarRecordatorios(db, { enviador, hoy });
    assert.equal(r.creadas, 8); // 4 documentos × (Pedro + admin)
    const aPedro = enviador.enviados.filter((e) => e.endpoint.endsWith('/pedro'));
    assert.equal(aPedro.length, 1);
    assert.equal(aPedro[0].titulo, 'Tienes 4 avisos nuevos');
  });

  test('sin claves VAPID los avisos quedan en la campanita pero no se envían', async () => {
    await db.query(`UPDATE documento_buseta SET fecha_soat = $1 WHERE buseta_id = 2`, [enDias(1, hoy)]);
    const r = await revisarRecordatorios(db, { enviador: { configurado: false }, hoy });
    assert.deepEqual(r, { creadas: 2, enviadas: 0 });
  });

  test('quitar la suscripción de este celular', async () => {
    assert.equal((await pedir('DELETE', '/suscripcion', pedro, { endpoint: SUSCRIPCION('pedro').endpoint })).status, 204);
    assert.equal((await pedir('POST', '/prueba', pedro)).status, 400);
  });
});
