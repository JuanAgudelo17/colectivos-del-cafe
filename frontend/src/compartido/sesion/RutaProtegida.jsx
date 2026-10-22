import { Navigate, Outlet } from 'react-router';
import { rutaInicio, useSesion } from './contexto.js';

// Solo deja pasar a usuarios con sesión y con el rol indicado.
// Es comodidad de interfaz: la seguridad real la aplica el backend.
export function RutaProtegida({ rol }) {
  const { usuario, cargando } = useSesion();

  if (cargando) return <p className="cargando">Cargando…</p>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (rol && usuario.rol !== rol) return <Navigate to={rutaInicio(usuario)} replace />;

  return <Outlet />;
}
