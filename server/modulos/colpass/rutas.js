import { Router } from 'express';
import { ErrorHttp, noEncontrado } from '../../compartido/http/errores.js';
import { idDeRuta, validar } from '../../compartido/http/validacion.js';
import { hoyBogota } from '../../compartido/fecha.js';
import { alcance, autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { listarBusetas, obtenerBuseta } from '../busetas/index.js';
import { activarEsquema, entregaEsquema, rangoConsulta } from './esquemas.js';
import { estadoDeCuenta } from './cuenta.js';
import {
  activarColpass,
  borrarEntrega,
  crearEntrega,
  diasConPeajes,
  listarColpass,
  obtenerColpass,
  obtenerEntrega,
  quitarColpass,
} from './repositorio.js';

const router = Router();

// El conductor puede borrar lo que registró durante estos días (por si se equivocó).
const DIAS_EDICION = 7;

const fechaCorta = (iso) => iso.split('-').reverse().join('/');
const enPesos = (valor) => `$ ${new Intl.NumberFormat('es-CO').format(valor)}`;

// Rango pedido o, por defecto, del primero del mes actual a hoy.
function rango(query) {
  const { desde, hasta } = validar(rangoConsulta, query);
  const hoy = hoyBogota();
  return { desde: desde ?? `${hoy.slice(0, 8)}01`, hasta: hasta ?? hoy };
}

function puedeBorrar(entrega, usuario) {
  if (usuario.rol === 'admin') return true;
  const reciente = Date.now() - new Date(entrega.creadoEn).getTime() <= DIAS_EDICION * 86_400_000;
  return entrega.registradoPor === usuario.id && reciente;
}

// Todo lo que se ve de una buseta con Colpass: lo pendiente, la consulta del
// rango (total y día por día) y las entregas (la más reciente primero).
async function armarDetalle(db, buseta, colpass, { desde, hasta }, usuario) {
  const [cuenta, delRango] = await Promise.all([
    estadoDeCuenta(db, buseta.id, colpass),
    diasConPeajes(db, buseta.id, desde, hasta),
  ]);
  const deLaCuenta = new Map(cuenta.dias.map((d) => [d.fecha, d]));
  // Los días antes del Colpass se pagaron en efectivo: no se entregan.
  const dias = delRango.map((d) => {
    if (d.fecha < colpass.desde) return { ...d, cubierto: 0, estado: 'antes' };
    const enCuenta = deLaCuenta.get(d.fecha);
    return { ...d, cubierto: enCuenta?.cubierto ?? 0, estado: enCuenta?.estado ?? 'pendiente' };
  });
  const sumar = (valor) => dias.reduce((t, d) => t + valor(d), 0);

  return {
    buseta: {
      id: buseta.id,
      numeroInterno: buseta.numeroInterno,
      placa: buseta.placa,
      conductor: buseta.conductor?.nombre ?? null,
    },
    colpass: { desde: colpass.desde },
    pendiente: cuenta.pendiente,
    saldoAFavor: cuenta.saldoAFavor,
    totalEntregado: cuenta.totalEntregado,
    consulta: {
      desde,
      hasta,
      total: sumar((d) => d.peajes),
      liquidado: sumar((d) => d.cubierto),
      porLiquidar: sumar((d) => (d.estado === 'antes' ? 0 : d.peajes - d.cubierto)),
      dias,
    },
    entregas: cuenta.entregas
      .map((e) => ({
        id: e.id,
        fecha: e.fecha,
        valor: e.valor,
        observacion: e.observacion,
        cubre: e.cubre,
        registradaPor: e.registradoPorRol === 'conductor' ? 'conductor' : 'admin',
        puedeBorrar: puedeBorrar(e, usuario),
      }))
      .reverse(),
  };
}

// Registra la plata entregada al propietario: queda liquidada de una vez y cubre
// los peajes pendientes más viejos. No se puede entregar más de lo pendiente.
async function registrarEntrega(db, { buseta, colpass, datos, conductorId, registradoPor }) {
  if (datos.fecha < colpass.desde) {
    throw new ErrorHttp(400, `El Colpass empezó el ${fechaCorta(colpass.desde)}`, { fecha: 'Antes del Colpass' });
  }
  if (datos.fecha > hoyBogota()) throw new ErrorHttp(400, 'La fecha no puede ser futura', { fecha: 'Fecha futura' });

  const { pendiente } = await estadoDeCuenta(db, buseta.id, colpass);
  if (pendiente.total === 0) throw new ErrorHttp(400, 'No hay peajes pendientes por entregar');
  if (datos.valor > pendiente.total) {
    throw new ErrorHttp(400, `Solo hay ${enPesos(pendiente.total)} de peajes pendientes`, {
      valor: `Máximo ${enPesos(pendiente.total)}`,
    });
  }
  await crearEntrega(db, { ...datos, busetaId: buseta.id, conductorId, registradoPor });
}

// ---- Conductor: consulta lo suyo y registra lo que entregó --------------------
const soloConductor = [autenticar, requiereRol('conductor')];

// Su buseta y su Colpass (null si no tiene). Nunca recibe un id: sale de la sesión.
async function miColpass(req) {
  const db = req.app.locals.db;
  const { busetaId } = alcance(req.usuario);
  const buseta = busetaId && (await obtenerBuseta(db, busetaId));
  const colpass = buseta && (await obtenerColpass(db, buseta.id));
  return colpass ? { buseta, colpass } : null;
}

async function miColpassObligatorio(req) {
  const mio = await miColpass(req);
  if (!mio) throw new ErrorHttp(404, 'Tu buseta no tiene Colpass');
  return mio;
}

router.get('/mio', soloConductor, async (req, res) => {
  const consulta = rango(req.query);
  const mio = await miColpass(req);
  if (!mio) return res.json({ colpass: null });
  res.json(await armarDetalle(req.app.locals.db, mio.buseta, mio.colpass, consulta, req.usuario));
});

router.post('/mio/entregas', soloConductor, async (req, res) => {
  const db = req.app.locals.db;
  const { buseta, colpass } = await miColpassObligatorio(req);
  const datos = validar(entregaEsquema, req.body);
  await registrarEntrega(db, { buseta, colpass, datos, conductorId: req.usuario.id, registradoPor: req.usuario.id });
  res.status(201).json(await armarDetalle(db, buseta, colpass, rango(req.query), req.usuario));
});

router.delete('/mio/entregas/:id', soloConductor, async (req, res) => {
  const db = req.app.locals.db;
  const { buseta, colpass } = await miColpassObligatorio(req);
  const entrega = await obtenerEntrega(db, idDeRuta(req));
  if (!entrega || entrega.busetaId !== buseta.id) throw noEncontrado('La entrega');
  if (!puedeBorrar(entrega, req.usuario)) {
    throw new ErrorHttp(403, `Solo puedes borrar lo que registraste en los últimos ${DIAS_EDICION} días`);
  }
  await borrarEntrega(db, entrega.id);
  res.json(await armarDetalle(db, buseta, colpass, rango(req.query), req.usuario));
});

// ---- Admin --------------------------------------------------------------------
router.use(autenticar, requiereRol('admin'));

// Busetas activas, con Colpass o no, y cuánto tienen pendiente por entregar.
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const [busetas, conColpass] = await Promise.all([listarBusetas(db), listarColpass(db)]);
  const desdeDe = new Map(conColpass.map((c) => [c.busetaId, c.desde]));

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
            pendiente: desde && (await estadoDeCuenta(db, b.id, { desde })).pendiente,
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
  res.json(await armarDetalle(db, buseta, { desde }, rango(req.query), req.usuario));
});

// Quitar el Colpass. Las entregas hechas se conservan.
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
  res.json(await armarDetalle(db, buseta, colpass, consulta, req.usuario));
});

// El admin también puede registrar una entrega (por ejemplo, si el conductor no lo hizo).
router.post('/:busetaId/entregas', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const colpass = await colpassDe(db, buseta);
  const datos = validar(entregaEsquema, req.body);
  await registrarEntrega(db, {
    buseta,
    colpass,
    datos,
    conductorId: buseta.conductor?.id ?? null,
    registradoPor: req.usuario.id,
  });
  res.status(201).json(await armarDetalle(db, buseta, colpass, rango(req.query), req.usuario));
});

router.delete('/:busetaId/entregas/:id', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const entrega = await obtenerEntrega(db, idDeRuta(req));
  if (!entrega || entrega.busetaId !== buseta.id) throw noEncontrado('La entrega');
  await borrarEntrega(db, entrega.id);
  res.json(await armarDetalle(db, buseta, await colpassDe(db, buseta), rango(req.query), req.usuario));
});

export default router;
