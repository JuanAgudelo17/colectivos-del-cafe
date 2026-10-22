import { noAutenticado, prohibido } from '../lib/errores.js';

// Un usuario sin empresa (admin global) accede a todas.
// Cualquier otro usuario solo a la suya.
export function puedeAccederEmpresa(usuario, empresaId) {
  if (usuario.empresaId === null) return usuario.rol === 'admin';
  return usuario.empresaId === Number(empresaId);
}

export function verificarAccesoEmpresa(usuario, empresaId) {
  if (!puedeAccederEmpresa(usuario, empresaId)) throw prohibido();
}

// Valida que la empresa de la URL (req.params[param]) sea accesible.
// Uso: router.get('/empresas/:empresaId/busetas', autenticar, requiereEmpresa(), handler)
export function requiereEmpresa(param = 'empresaId') {
  return (req, res, next) => {
    if (!req.usuario) throw noAutenticado();
    const empresaId = Number(req.params[param]);
    if (!Number.isSafeInteger(empresaId)) throw prohibido();
    verificarAccesoEmpresa(req.usuario, empresaId);
    next();
  };
}

// Filtros que toda consulta de datos de negocio debe aplicar según quién pregunta.
// null en un campo = sin restricción por ese campo.
export function alcance(usuario) {
  if (usuario.rol === 'admin') {
    return { empresaId: usuario.empresaId, busetaId: null, conductorId: null };
  }
  return { empresaId: usuario.empresaId, busetaId: usuario.busetaId, conductorId: usuario.id };
}

// Empresa por la que filtrar un listado: la pedida en ?empresaId= (si tiene
// acceso) o, si no se pide ninguna, la de su alcance (null = todas).
export function empresaDelListado(req) {
  const pedida = req.query.empresaId;
  if (pedida === undefined || pedida === '') return alcance(req.usuario).empresaId;

  const empresaId = Number(pedida);
  if (!Number.isSafeInteger(empresaId)) throw prohibido();
  verificarAccesoEmpresa(req.usuario, empresaId);
  return empresaId;
}
