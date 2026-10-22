import { createContext, useContext } from 'react';

export const SesionContext = createContext(null);

// { usuario, cargando, aviso, iniciarSesion, cerrarSesion }
export function useSesion() {
  return useContext(SesionContext);
}

export function rutaInicio(usuario) {
  return usuario?.rol === 'admin' ? '/admin' : '/conductor';
}
