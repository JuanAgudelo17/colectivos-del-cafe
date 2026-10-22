import { Navigate, Outlet } from 'react-router';
import { rutaInicio, useSesion } from './contexto.js';

// Solo deja pasar a usuarios con sesión y con el rol indicado (sin rol = cualquiera).
// Con contraseña temporal, todo lleva a /cambiar-password hasta que cree la suya.
// Es comodidad de interfaz: la seguridad real la aplica el backend.
export function RutaProtegida({ rol, permitirPasswordTemporal = false }) {
  const { usuario, cargando } = useSesion();

  if (cargando) return <p className="cargando">Cargando…</p>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.debeCambiarPassword && !permitirPasswordTemporal) return <Navigate to="/cambiar-password" replace />;
  if (rol && usuario.rol !== rol) return <Navigate to={rutaInicio(usuario)} replace />;

  return <Outlet />;
}
