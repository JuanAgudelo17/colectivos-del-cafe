import express from 'express';
import { ErrorHttp } from './lib/errores.js';
import auth from './routes/auth.js';
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

  api.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  app.use(['/api', '/.netlify/functions/api'], api);
  app.use(manejarErrores);

  return app;
}

// Solo los ErrorHttp muestran su mensaje; el resto nunca expone detalles
// internos al cliente.
// eslint-disable-next-line no-unused-vars
export function manejarErrores(err, req, res, next) {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);

  let error = 'Error interno del servidor';
  if (err instanceof ErrorHttp) error = err.message;
  else if (status < 500) error = 'Solicitud inválida';

  res.status(status).json({ error });
}
