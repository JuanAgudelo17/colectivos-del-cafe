import express from 'express';
import { ErrorHttp, traducirErrorBd } from './lib/errores.js';
import auth from './routes/auth.js';
import busetas from './routes/busetas.js';
import conductores from './routes/conductores.js';
import empresas from './routes/empresas.js';
import salud from './routes/salud.js';

// `db` es cualquier objeto con query(sql, params) → { rows }:
// un pg.Pool en producción o PGlite en las pruebas.
export function crearApp({ db }) {
  const app = express();

  app.disable('x-powered-by');
  app.locals.db = db;
  app.use(express.json({ limit: '1mb' }));

  // Las rutas se montan en un router propio para poder servirlas tanto en /api
  // (redirect de netlify.toml) como en /.netlify/functions/api (llamada directa).
  const api = express.Router();
  api.use('/salud', salud);
  api.use('/auth', auth);
  api.use('/empresas', empresas);
  api.use('/busetas', busetas);
  api.use('/conductores', conductores);

  api.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  app.use(['/api', '/.netlify/functions/api'], api);
  app.use(manejarErrores);

  return app;
}

// Solo los ErrorHttp (y las restricciones de BD conocidas) muestran su mensaje;
// el resto nunca expone detalles internos al cliente.
// eslint-disable-next-line no-unused-vars
export function manejarErrores(err, req, res, next) {
  err = traducirErrorBd(err) ?? err;
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);

  if (err instanceof ErrorHttp) {
    return res.status(status).json({ error: err.message, ...(err.campos && { campos: err.campos }) });
  }
  res.status(status).json({ error: status < 500 ? 'Solicitud inválida' : 'Error interno del servidor' });
}
