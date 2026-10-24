import { Router } from 'express';
import { validar } from '../../compartido/http/validacion.js';
import { mesActualBogota } from '../../compartido/fecha.js';
import { alcance, autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { listarBusetas } from '../busetas/index.js';
import { cierresDelMes, producidoPorBuseta, rangoDelMes } from '../producido/index.js';
import { mesOpcional } from './esquemas.js';

const router = Router();
router.use(autenticar, requiereRol('admin', 'conductor'));

// Ranking del mes (por defecto el actual). Solo número, placa, producido y días:
// a los conductores no se les muestra nada más de las otras busetas.
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const actual = mesActualBogota();
  const { anio = actual.anio, mes = actual.mes } = validar(mesOpcional, req.query);
  const { desde, hasta } = rangoDelMes(anio, mes);
  const [busetas, producido, cierres] = await Promise.all([
    listarBusetas(db),
    producidoPorBuseta(db, desde, hasta),
    cierresDelMes(db, anio, mes),
  ]);
  const de = new Map(producido.map((p) => [p.busetaId, p]));
  // Un mes cerrado con la liquidación de la cooperativa usa el bruto del documento.
  const cierreDe = new Map(cierres.map((c) => [c.busetaId, c]));
  const { busetaId: propia } = alcance(req.usuario);

  const filas = busetas
    // Las desactivadas solo si trabajaron ese mes.
    .filter((b) => b.activo || de.has(b.id) || cierreDe.has(b.id))
    .map((b) => ({
      id: b.id,
      numeroInterno: b.numeroInterno,
      placa: b.placa,
      bruto: cierreDe.get(b.id)?.bruto ?? de.get(b.id)?.bruto ?? 0,
      diasTrabajados: de.get(b.id)?.diasTrabajados ?? 0,
      liquidacion: cierreDe.get(b.id)?.origen === 'liquidacion',
      propia: req.usuario.rol === 'conductor' && b.id === propia,
    }))
    .sort((a, b) => b.bruto - a.bruto || a.numeroInterno.localeCompare(b.numeroInterno, 'es', { numeric: true }));

  // Puesto solo para las que produjeron algo; empates comparten puesto.
  let puesto = 0;
  const ranking = filas.map((f, i) => {
    if (f.bruto > 0 && (i === 0 || f.bruto !== filas[i - 1].bruto)) puesto = i + 1;
    return { ...f, puesto: f.bruto > 0 ? puesto : null };
  });

  res.json({ anio, mes, busetas: ranking });
});

export default router;
