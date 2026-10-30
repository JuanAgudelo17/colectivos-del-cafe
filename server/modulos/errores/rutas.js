import { Router } from 'express';
import { z } from 'zod';
import { noEncontrado } from '../../compartido/http/errores.js';
import { idDeRuta, validar } from '../../compartido/http/validacion.js';
import { autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { COOKIE_SESION, leerCookie, verificarToken } from '../../compartido/seguridad/sesion.js';
import { enviadorDesdeEntorno } from '../notificaciones/index.js';
import { registrarError } from './registrar.js';
import { contarPendientes, erroresNavegadorDelDia, listarErrores, marcarResuelto } from './repositorio.js';

const router = Router();

// Tope de errores distintos del navegador por día: por si alguien manda basura.
const MAXIMO_NAVEGADOR_DIA = 100;

const reporteEsquema = z.object({
  mensaje: z.string().trim().min(1).max(500),
  detalle: z.string().max(4000).optional(),
  ruta: z.string().max(300).optional(),
});

// El navegador reporta un error (pantalla rota, error de JavaScript). Puede
// pasar antes de iniciar sesión, así que no la exige; si hay, se anota quién.
router.post('/', async (req, res) => {
  const datos = validar(reporteEsquema, req.body);
  const db = req.app.locals.db;
  if ((await erroresNavegadorDelDia(db)) < MAXIMO_NAVEGADOR_DIA) {
    const token = leerCookie(req, COOKIE_SESION);
    const sesion = token && (await verificarToken(token).catch(() => null));
    await registrarError(
      db,
      { ...datos, origen: 'navegador', usuarioId: sesion?.id ?? null, navegador: req.get('user-agent') },
      { enviador: (req.app.locals.enviador ??= enviadorDesdeEntorno()) },
    );
  }
  res.status(204).end();
});

// ---- Admin: ver y marcar resueltos ----------------------------------------------
router.use(autenticar, requiereRol('admin'));

router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const resueltos = req.query.resueltos === '1';
  const [errores, pendientes] = await Promise.all([listarErrores(db, { resueltos }), contarPendientes(db)]);
  res.json({ errores, pendientes });
});

router.post('/:id/resuelto', async (req, res) => {
  if (!(await marcarResuelto(req.app.locals.db, idDeRuta(req)))) throw noEncontrado('El error');
  res.json({ pendientes: await contarPendientes(req.app.locals.db) });
});

export default router;
