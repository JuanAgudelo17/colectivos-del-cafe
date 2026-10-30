import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, borrarDatosSinConexion, configurarSinConexion, EVENTO_SESION_EXPIRADA } from '../api.js';
import { SesionContext } from './contexto.js';

export function ProveedorSesion({ children }) {
  const [usuario, setUsuarioEstado] = useState(null);
  // Lo del conductor queda guardado en el celular para verlo sin señal (ver sw.js).
  // Se marca aquí y no en un efecto: las páginas consultan antes de que corran
  // los efectos de este proveedor.
  const setUsuario = useCallback((nuevo) => {
    configurarSinConexion(nuevo?.rol === 'conductor');
    setUsuarioEstado(nuevo);
  }, []);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState(null);

  // Al abrir la app, preguntar si ya hay una sesión activa (cookie).
  useEffect(() => {
    api('/auth/yo')
      .then((datos) => setUsuario(datos.usuario))
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, [setUsuario]);

  // La sesión vence a los 30 min sin actividad. Las peticiones normales la
  // renuevan, pero alguien puede pasar más tiempo escribiendo un formulario sin
  // guardar: si teclea o toca la pantalla, se renueva (a lo sumo cada 5 min).
  useEffect(() => {
    if (!usuario) return;
    let ultima = Date.now();
    const renovar = () => {
      if (Date.now() - ultima < 5 * 60 * 1000) return;
      ultima = Date.now();
      api('/auth/yo').catch(() => {});
    };
    window.addEventListener('keydown', renovar);
    window.addEventListener('pointerdown', renovar);
    return () => {
      window.removeEventListener('keydown', renovar);
      window.removeEventListener('pointerdown', renovar);
    };
  }, [usuario]);

  // Si cualquier petición recibe 401, la sesión venció por inactividad.
  useEffect(() => {
    const alExpirar = () => {
      borrarDatosSinConexion();
      setUsuario(null);
      setAviso('Tu sesión se cerró por inactividad. Vuelve a ingresar.');
    };
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
  }, [setUsuario]);

  const iniciarSesion = useCallback(async (nombreUsuario, password) => {
    const datos = await api('/auth/login', {
      method: 'POST',
      cuerpo: { usuario: nombreUsuario, password },
    });
    // Por si antes se usó otra cuenta en este celular.
    await borrarDatosSinConexion();
    setAviso(null);
    setUsuario(datos.usuario);
    return datos.usuario;
  }, [setUsuario]);

  const cerrarSesion = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    await borrarDatosSinConexion();
    setUsuario(null);
  }, [setUsuario]);

  const valor = useMemo(
    () => ({ usuario, cargando, aviso, iniciarSesion, cerrarSesion, actualizarUsuario: setUsuario }),
    [usuario, cargando, aviso, iniciarSesion, cerrarSesion, setUsuario],
  );

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}
