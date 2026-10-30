import express from 'express';
import { almacenDesdeEntorno } from './compartido/almacen.js';
import { ErrorHttp, traducirErrorBd } from './compartido/http/errores.js';
import { registrarError } from './modulos/errores/index.js';
import { enviadorDesdeEntorno } from './modulos/notificaciones/index.js';
import { modulos as modulosRegistrados } from './modulos/index.js';

// `db` es cualquier objeto con query(sql, params) → { rows }:
// un pg.Pool en producción o PGlite en las pruebas.
// `almacen` guarda los archivos (Supabase Storage; en las pruebas, en memoria).
export function crearApp({ db, almacen = almacenDesdeEntorno(), modulos = modulosRegistrados }) {
  const app = express();

  app.disable('x-powered-by');
  app.locals.db = db;
  app.locals.almacen = almacen;
  app.use(express.json({ limit: '1mb' }));

  // Las rutas se montan en un router propio para poder servirlas tanto en /api
  // (redirect de netlify.toml) como en /.netlify/functions/api (llamada directa).
  const api = express.Router();
  for (const modulo of modulos) api.use(modulo.ruta, modulo.router);

  api.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  app.use(['/api', '/.netlify/functions/api'], api);

  const restricciones = Object.assign({}, ...modulos.map((m) => m.restricciones));
  app.use(crearManejadorErrores(restricciones));

  return app;
}

// Lo que tarda como máximo guardar el error antes de responder (en Netlify la
// función se congela al responder, así que se espera, pero sin colgar al usuario).
const ESPERA_REGISTRO_MS = 2500;

// Solo los ErrorHttp (y las restricciones de BD que declaran los módulos)
// muestran su mensaje; el resto nunca expone detalles internos al cliente.
// Los 500 se guardan en el registro de errores y se les avisa a los admin.
export function crearManejadorErrores(restricciones = {}) {
  // eslint-disable-next-line no-unused-vars
  return async (err, req, res, next) => {
    err = traducirErrorBd(err, restricciones) ?? err;
    const status = err.status ?? 500;
    if (status >= 500) {
      console.error(err);
      if (req.app.locals.db) {
        const registro = registrarError(
          req.app.locals.db,
          {
            origen: 'servidor',
            mensaje: err.message,
            detalle: err.stack,
            // Sin los ids ni la consulta: /api/producido/3/2026-08-01?x → /api/producido/:id/:id
            ruta: `${req.method} ${req.originalUrl.split('?')[0].replace(/\/\d[\w-]*/g, '/:id')}`,
            usuarioId: req.usuario?.id ?? null,
            navegador: req.get('user-agent'),
          },
          { enviador: (req.app.locals.enviador ??= enviadorDesdeEntorno()) },
        );
        await Promise.race([registro, new Promise((r) => setTimeout(r, ESPERA_REGISTRO_MS).unref?.())]);
      }
    }

    if (err instanceof ErrorHttp) {
      return res.status(status).json({ error: err.message, ...(err.campos && { campos: err.campos }) });
    }
    res.status(status).json({ error: status < 500 ? 'Solicitud inválida' : 'Error interno del servidor' });
  };
}
