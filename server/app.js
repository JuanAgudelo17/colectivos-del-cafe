import express from 'express';
import salud from './routes/salud.js';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// Las rutas se montan en un router propio para poder servirlas tanto en /api
// (redirect de netlify.toml) como en /.netlify/functions/api (llamada directa).
const api = express.Router();
api.use('/salud', salud);

api.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use(['/api', '/.netlify/functions/api'], api);

// Manejador de errores: nunca exponer detalles internos al cliente.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: 'Error interno del servidor' });
});

export default app;
