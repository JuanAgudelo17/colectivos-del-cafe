import { createContext, useContext } from 'react';

export const SesionContext = createContext(null);

// { usuario, cargando, aviso, iniciarSesion, cerrarSesion, actualizarUsuario }
export function useSesion() {
  return useContext(SesionContext);
}

// A dónde va el usuario al entrar. Con contraseña temporal, primero debe crear la suya.
export function rutaInicio(usuario) {
  if (usuario?.debeCambiarPassword) return '/cambiar-password';
  return usuario?.rol === 'admin' ? '/admin' : '/conductor';
}
