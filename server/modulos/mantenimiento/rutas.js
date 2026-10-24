import { Router } from 'express';
import { ErrorHttp, noEncontrado } from '../../compartido/http/errores.js';
import { idDeRuta, validar } from '../../compartido/http/validacion.js';
import { alcance, autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { obtenerBuseta } from '../busetas/index.js';
import { DIAS_EDICION, armarEstados, puedeEditar } from './estado.js';
import { estadoDeLaFlota } from './flota.js';
import { lecturaEsquema, registroCrear, registroEditar, tipoEditar } from './esquemas.js';
import {
  actualizarRegistro,
  actualizarTipo,
  borrarLectura,
  borrarRegistro,
  crearRegistros,
  guardarLectura,
  kilometrajesActuales,
  lecturaDelDia,
  limitesKilometraje,
  listarLecturas,
  listarRegistros,
  listarTipos,
  obtenerLectura,
  obtenerRegistro,
  ultimosPorTipo,
} from './repositorio.js';

const router = Router();
router.use(autenticar, requiereRol('admin', 'conductor'));

const kms = new Intl.NumberFormat('es-CO');
const sinPermiso = () =>
  new ErrorHttp(403, `Solo puedes corregir o borrar lo que registraste en los últimos ${DIAS_EDICION} días`);

// ---- Tipos e intervalos (los ven todos; los cambia el admin) ------------------
router.get('/tipos', async (req, res) => {
  res.json({ tipos: await listarTipos(req.app.locals.db) });
});

router.put('/tipos/:clave', requiereRol('admin'), async (req, res) => {
  const datos = validar(tipoEditar, req.body);
  if (!(await actualizarTipo(req.app.locals.db, req.params.clave, datos))) throw noEncontrado('El tipo de mantenimiento');
  res.json({ tipos: await listarTipos(req.app.locals.db) });
});

// ---- Admin: estado de toda la flota (para el panel general) -------------------
router.get('/', requiereRol('admin'), async (req, res) => {
  res.json({ busetas: await estadoDeLaFlota(req.app.locals.db) });
});

// ---- Hoja de mantenimiento de una buseta --------------------------------------
// El conductor solo llega a la suya (cualquier otro id responde 404, igual que
// si no existiera). Ojo: un conductor sin buseta tiene busetaId null, que en
// `alcance` del admin significa "sin restricción"; por eso se mira el rol.
async function busetaDeRuta(req) {
  const id = idDeRuta(req, 'busetaId');
  const { busetaId } = alcance(req.usuario);
  const permitida = req.usuario.rol === 'admin' || busetaId === id;
  const buseta = permitida && (await obtenerBuseta(req.app.locals.db, id));
  if (!buseta) throw noEncontrado('La buseta');
  return buseta;
}

async function armarHoja(db, buseta, usuario) {
  const [tipos, kilometrajes, ultimos, registros, lecturas] = await Promise.all([
    listarTipos(db),
    kilometrajesActuales(db, buseta.id),
    ultimosPorTipo(db, buseta.id),
    listarRegistros(db, buseta.id),
    listarLecturas(db, buseta.id),
  ]);
  const kilometraje = kilometrajes[0] ? { actual: kilometrajes[0].actual, fecha: kilometrajes[0].fecha } : null;
  const conPermiso = ({ busetaId, creadoEn, ...r }) => ({ ...r, editable: puedeEditar(usuario, { ...r, creadoEn }) });

  return {
    buseta: { id: buseta.id, numeroInterno: buseta.numeroInterno, placa: buseta.placa },
    kilometraje,
    estados: armarEstados(tipos, ultimos, kilometraje?.actual ?? null),
    tipos,
    registros: registros.map(conPermiso),
    lecturas: lecturas.map(conPermiso),
    diasEdicion: DIAS_EDICION,
  };
}

// El odómetro no retrocede: un kilometraje no puede ser menor que el de una
// fecha anterior ni mayor que el de una posterior.
async function verificarKilometraje(db, busetaId, fecha, kilometraje, excluir) {
  if (kilometraje === null) return;
  const { maxAntes, minDespues } = await limitesKilometraje(db, busetaId, fecha, excluir);
  let mensaje = null;
  if (maxAntes !== null && kilometraje < maxAntes) {
    mensaje = `No puede ser menor que el de un registro anterior (${kms.format(maxAntes)} km)`;
  } else if (minDespues !== null && kilometraje > minDespues) {
    mensaje = `No puede ser mayor que el de un registro posterior (${kms.format(minDespues)} km)`;
  }
  if (mensaje) throw new ErrorHttp(400, 'Revisa el kilometraje', { kilometraje: mensaje });
}

async function verificarTipos(db, claves, { permitirInactivo = null } = {}) {
  const tipos = new Map((await listarTipos(db)).map((t) => [t.clave, t]));
  for (const clave of claves) {
    const tipo = tipos.get(clave);
    if (!tipo || (!tipo.activo && clave !== permitirInactivo)) {
      throw new ErrorHttp(400, 'Revisa los datos del formulario', { tipo: 'Tipo de mantenimiento inválido' });
    }
  }
}

router.get('/:busetaId', async (req, res) => {
  const buseta = await busetaDeRuta(req);
  res.json(await armarHoja(req.app.locals.db, buseta, req.usuario));
});

// ---- Kilometraje --------------------------------------------------------------
router.post('/:busetaId/kilometraje', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const datos = validar(lecturaEsquema, req.body);

  // Reportar otra vez el mismo día reemplaza la lectura, si es suya y reciente.
  const existente = await lecturaDelDia(db, buseta.id, datos.fecha);
  if (existente && !puedeEditar(req.usuario, existente)) {
    throw new ErrorHttp(409, 'Ya hay un kilometraje de ese día. Pídele al administrador que lo corrija.');
  }
  await verificarKilometraje(db, buseta.id, datos.fecha, datos.kilometraje, { lecturaId: existente?.id });
  await guardarLectura(db, { ...datos, busetaId: buseta.id, registradoPor: req.usuario.id });
  res.status(201).json(await armarHoja(db, buseta, req.usuario));
});

router.delete('/:busetaId/kilometraje/:id', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const lectura = await obtenerLectura(db, idDeRuta(req));
  if (!lectura || lectura.busetaId !== buseta.id) throw noEncontrado('La lectura');
  if (!puedeEditar(req.usuario, lectura)) throw sinPermiso();
  await borrarLectura(db, lectura.id);
  res.json(await armarHoja(db, buseta, req.usuario));
});

// ---- Registros de mantenimiento -----------------------------------------------
router.post('/:busetaId/registros', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const datos = validar(registroCrear, req.body);
  await verificarTipos(db, datos.items.map((i) => i.tipo));
  await verificarKilometraje(db, buseta.id, datos.fecha, datos.kilometraje);
  await crearRegistros(db, { ...datos, busetaId: buseta.id, registradoPor: req.usuario.id });
  res.status(201).json(await armarHoja(db, buseta, req.usuario));
});

async function registroDeRuta(req, buseta) {
  const registro = await obtenerRegistro(req.app.locals.db, idDeRuta(req));
  if (!registro || registro.busetaId !== buseta.id) throw noEncontrado('El registro');
  if (!puedeEditar(req.usuario, registro)) throw sinPermiso();
  return registro;
}

router.put('/:busetaId/registros/:id', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const registro = await registroDeRuta(req, buseta);
  const datos = validar(registroEditar, req.body);
  await verificarTipos(db, [datos.tipo], { permitirInactivo: registro.tipo });
  await verificarKilometraje(db, buseta.id, datos.fecha, datos.kilometraje, { registroId: registro.id });
  await actualizarRegistro(db, registro.id, datos);
  res.json(await armarHoja(db, buseta, req.usuario));
});

router.delete('/:busetaId/registros/:id', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const registro = await registroDeRuta(req, buseta);
  await borrarRegistro(db, registro.id);
  res.json(await armarHoja(db, buseta, req.usuario));
});

export default router;
