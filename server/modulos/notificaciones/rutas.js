import { Router } from 'express';
import { ErrorHttp } from '../../compartido/http/errores.js';
import { validar } from '../../compartido/http/validacion.js';
import { autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { enviadorDesdeEntorno } from './envio.js';
import { leidasEsquema, quitarSuscripcionEsquema, suscripcionEsquema } from './esquemas.js';
import {
  borrarSuscripcion,
  contarNoLeidas,
  guardarSuscripcion,
  listarNotificaciones,
  marcarLeidas,
  suscripcionesDe,
} from './repositorio.js';

const router = Router();
// Cada usuario solo ve y maneja sus propios avisos y suscripciones.
router.use(autenticar, requiereRol('admin', 'conductor'));

// Las pruebas ponen uno falso en app.locals.enviador.
const enviadorDe = (req) => (req.app.locals.enviador ??= enviadorDesdeEntorno());

// Avisos del usuario (los 30 más recientes), cuántos sin leer y la clave pública
// para que el navegador se suscriba.
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const [notificaciones, noLeidas] = await Promise.all([
    listarNotificaciones(db, req.usuario.id),
    contarNoLeidas(db, req.usuario.id),
  ]);
  const enviador = enviadorDe(req);
  res.json({ notificaciones, noLeidas, push: { disponible: enviador.configurado, clavePublica: enviador.clavePublica } });
});

router.post('/leidas', async (req, res) => {
  const { ids } = validar(leidasEsquema, req.body);
  await marcarLeidas(req.app.locals.db, req.usuario.id, ids ?? null);
  res.json({ noLeidas: await contarNoLeidas(req.app.locals.db, req.usuario.id) });
});

// Este celular quiere recibir notificaciones.
router.post('/suscripcion', async (req, res) => {
  if (!enviadorDe(req).configurado) throw new ErrorHttp(503, 'Las notificaciones al celular no están configuradas');
  await guardarSuscripcion(req.app.locals.db, req.usuario.id, validar(suscripcionEsquema, req.body));
  res.status(201).json({ ok: true });
});

// Este celular ya no quiere recibirlas.
router.delete('/suscripcion', async (req, res) => {
  const { endpoint } = validar(quitarSuscripcionEsquema, req.body);
  await borrarSuscripcion(req.app.locals.db, endpoint, req.usuario.id);
  res.status(204).end();
});

// Manda un aviso de prueba a los celulares del usuario.
router.post('/prueba', async (req, res) => {
  const db = req.app.locals.db;
  const enviador = enviadorDe(req);
  const suscripciones = await suscripcionesDe(db, [req.usuario.id]);
  if (!enviador.configurado || suscripciones.length === 0) {
    throw new ErrorHttp(400, 'Primero activa las notificaciones en este celular');
  }
  let enviadas = 0;
  for (const s of suscripciones) {
    const resultado = await enviador.enviar(s, {
      titulo: 'Notificaciones activadas',
      cuerpo: 'Así te llegarán los recordatorios de El Producido.',
      url: req.usuario.rol === 'admin' ? '/admin' : '/conductor',
      clave: 'prueba',
    });
    if (resultado === 'enviada') enviadas += 1;
    if (resultado === 'vencida') await borrarSuscripcion(db, s.endpoint);
  }
  res.json({ enviadas });
});

export default router;
