import { noAutenticado, prohibido } from '../lib/errores.js';

// Un usuario sin empresa (admin global) accede a todas.
// Cualquier otro usuario solo a la suya.
export function puedeAccederEmpresa(usuario, empresaId) {
  if (usuario.empresaId === null) return usuario.rol === 'admin';
  return usuario.empresaId === Number(empresaId);
}

// Valida que la empresa de la URL (req.params[param]) sea accesible.
// Uso: router.get('/empresas/:empresaId/busetas', autenticar, requiereEmpresa(), handler)
export function requiereEmpresa(param = 'empresaId') {
  return (req, res, next) => {
    if (!req.usuario) throw noAutenticado();
    const empresaId = Number(req.params[param]);
    if (!Number.isSafeInteger(empresaId) || !puedeAccederEmpresa(req.usuario, empresaId)) {
      throw prohibido();
    }
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
