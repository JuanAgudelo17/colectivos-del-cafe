import { Router } from 'express';
import { ErrorHttp, noEncontrado } from '../../compartido/http/errores.js';
import { idDeRuta, validar } from '../../compartido/http/validacion.js';
import { hoyBogota } from '../../compartido/fecha.js';
import { alcance, autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { listarBusetas, obtenerBuseta } from '../busetas/index.js';
import { activarEsquema, liquidacionEsquema, rangoConsulta } from './esquemas.js';
import {
  activarColpass,
  borrarLiquidacion,
  crearLiquidacion,
  diasConPeajes,
  liquidacionQueSeCruza,
  listarColpass,
  listarLiquidaciones,
  obtenerColpass,
  obtenerLiquidacion,
  pendiente,
  quitarColpass,
  sumaPeajes,
} from './repositorio.js';

const router = Router();

const fechaCorta = (iso) => iso.split('-').reverse().join('/');

// Rango pedido o, por defecto, del primero del mes actual a hoy.
function rango(query) {
  const { desde, hasta } = validar(rangoConsulta, query);
  const hoy = hoyBogota();
  return { desde: desde ?? `${hoy.slice(0, 8)}01`, hasta: hasta ?? hoy };
}

// Todo lo que se ve de una buseta con Colpass: lo pendiente por liquidar, la
// consulta del rango (total y día por día) y las liquidaciones.
// conductorId: limita a lo de ese conductor (vista del conductor).
async function armarDetalle(db, buseta, colpass, { desde, hasta }, conductorId = null) {
  const filtro = { busetaId: buseta.id, conductorId };
  const [porLiquidar, dias, liquidaciones] = await Promise.all([
    pendiente(db, { ...filtro, desde: colpass.desde, hasta: hoyBogota() }),
    diasConPeajes(db, { ...filtro, desde, hasta }),
    listarLiquidaciones(db, buseta.id, conductorId),
  ]);
  const sumar = (lista) => lista.reduce((t, d) => t + d.peajes, 0);

  return {
    buseta: {
      id: buseta.id,
      numeroInterno: buseta.numeroInterno,
      placa: buseta.placa,
      conductor: buseta.conductor?.nombre ?? null,
    },
    colpass: { desde: colpass.desde },
    pendiente: porLiquidar,
    consulta: {
      desde,
      hasta,
      total: sumar(dias),
      liquidado: sumar(dias.filter((d) => d.liquidado)),
      // Los días antes del Colpass se pagaron en efectivo: no quedan por liquidar.
      porLiquidar: sumar(dias.filter((d) => !d.liquidado && d.fecha >= colpass.desde)),
      dias,
    },
    liquidaciones,
  };
}

// ---- Conductor: solo consulta lo suyo -----------------------------------------
router.get('/mio', autenticar, requiereRol('conductor'), async (req, res) => {
  const db = req.app.locals.db;
  const consulta = rango(req.query);
  const { busetaId, conductorId } = alcance(req.usuario);
  const buseta = busetaId && (await obtenerBuseta(db, busetaId));
  const colpass = buseta && (await obtenerColpass(db, buseta.id));
  if (!colpass) return res.json({ colpass: null });

  const detalle = await armarDetalle(db, buseta, colpass, consulta, conductorId);
  // El conductor no necesita las notas internas del admin ni el valor recalculado.
  detalle.liquidaciones = detalle.liquidaciones.map(({ id, desde, hasta, valor, creadoEn }) => ({
    id,
    desde,
    hasta,
    valor,
    creadoEn,
  }));
  res.json(detalle);
});

// ---- Admin --------------------------------------------------------------------
router.use(autenticar, requiereRol('admin'));

// Busetas activas, con Colpass o no (para activarlo), y cuánto tienen por liquidar.
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const [busetas, conColpass] = await Promise.all([listarBusetas(db), listarColpass(db)]);
  const desdeDe = new Map(conColpass.map((c) => [c.busetaId, c.desde]));
  const hoy = hoyBogota();

  res.json({
    busetas: await Promise.all(
      busetas
        .filter((b) => b.activo || desdeDe.has(b.id))
        .map(async (b) => {
          const desde = desdeDe.get(b.id) ?? null;
          return {
            id: b.id,
            numeroInterno: b.numeroInterno,
            placa: b.placa,
            conductor: b.conductor?.nombre ?? null,
            colpass: desde && { desde },
            pendiente: desde && (await pendiente(db, { busetaId: b.id, desde, hasta: hoy })),
          };
        }),
    ),
  });
});

async function busetaDeRuta(req) {
  const buseta = await obtenerBuseta(req.app.locals.db, idDeRuta(req, 'busetaId'));
  if (!buseta) throw noEncontrado('La buseta');
  return buseta;
}

async function colpassDe(db, buseta) {
  const colpass = await obtenerColpass(db, buseta.id);
  if (!colpass) throw new ErrorHttp(404, `La ${buseta.numeroInterno} no tiene Colpass`);
  return colpass;
}

// Activar el Colpass (o cambiar desde cuándo lo tiene).
router.put('/:busetaId', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const { desde } = validar(activarEsquema, req.body);
  if (desde > hoyBogota()) throw new ErrorHttp(400, 'La fecha no puede ser futura', { desde: 'Fecha futura' });
  await activarColpass(db, buseta.id, desde);
  res.json(await armarDetalle(db, buseta, { desde }, rango(req.query)));
});

// Quitar el Colpass. Las liquidaciones hechas se conservan.
router.delete('/:busetaId', async (req, res) => {
  const buseta = await busetaDeRuta(req);
  await quitarColpass(req.app.locals.db, buseta.id);
  res.status(204).end();
});

// Detalle de una buseta (el apartado de Producido). Sin Colpass responde
// `colpass: null` para que el admin pueda activarlo desde ahí.
router.get('/:busetaId', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const consulta = rango(req.query);
  const colpass = await obtenerColpass(db, buseta.id);
  if (!colpass) return res.json({ buseta: { id: buseta.id, numeroInterno: buseta.numeroInterno }, colpass: null });
  res.json(await armarDetalle(db, buseta, colpass, consulta));
});

// Liquidar: el conductor le entregó al admin la plata de los peajes de esos días.
router.post('/:busetaId/liquidaciones', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const colpass = await colpassDe(db, buseta);
  const datos = validar(liquidacionEsquema, req.body);

  if (datos.desde < colpass.desde) {
    throw new ErrorHttp(400, `El Colpass empezó el ${fechaCorta(colpass.desde)}; antes no hay nada que liquidar`, {
      desde: 'Antes del Colpass',
    });
  }
  if (datos.hasta > hoyBogota()) {
    throw new ErrorHttp(400, 'No se pueden liquidar días que no han pasado', { hasta: 'Fecha futura' });
  }
  const cruce = await liquidacionQueSeCruza(db, buseta.id, datos.desde, datos.hasta);
  if (cruce) {
    throw new ErrorHttp(
      409,
      `Esos días se cruzan con la liquidación del ${fechaCorta(cruce.desde)} al ${fechaCorta(cruce.hasta)}`,
    );
  }
  const valor = await sumaPeajes(db, buseta.id, datos.desde, datos.hasta);
  if (valor === 0) throw new ErrorHttp(400, 'No hay peajes registrados en esos días');

  await crearLiquidacion(db, {
    ...datos,
    busetaId: buseta.id,
    conductorId: buseta.conductor?.id ?? null,
    valor,
    registradoPor: req.usuario.id,
  });
  res.status(201).json(await armarDetalle(db, buseta, colpass, rango(req.query)));
});

router.delete('/:busetaId/liquidaciones/:id', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const liquidacion = await obtenerLiquidacion(db, idDeRuta(req));
  if (!liquidacion || liquidacion.busetaId !== buseta.id) throw noEncontrado('La liquidación');
  await borrarLiquidacion(db, liquidacion.id);
  res.json(await armarDetalle(db, buseta, await colpassDe(db, buseta), rango(req.query)));
});

export default router;
