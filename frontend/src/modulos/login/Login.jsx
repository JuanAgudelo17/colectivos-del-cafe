import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { PantallaAcceso } from '../../compartido/layout/PantallaAcceso.jsx';
import { rutaInicio, useSesion } from '../../compartido/sesion/contexto.js';

export function Login() {
  const { usuario, cargando, aviso, iniciarSesion } = useSesion();
  const navegar = useNavigate();
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  if (cargando) return <p className="cargando">Cargando…</p>;
  if (usuario) return <Navigate to={rutaInicio(usuario)} replace />;

  async function enviar(evento) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);
    setEnviando(true);
    try {
      const sesion = await iniciarSesion(datos.get('usuario'), datos.get('password'));
      navegar(rutaInicio(sesion), { replace: true });
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <PantallaAcceso>
      <p className="acceso-ubicacion">Pereira, Risaralda</p>
      <h1>Las cuentas de tu buseta, al día</h1>
      <p className="subtitulo">Ingresa con tu usuario y contraseña.</p>

      {aviso && !error && <p className="aviso">{aviso}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={enviar}>
        <label>
          Usuario
          <input name="usuario" autoComplete="username" autoCapitalize="none" required />
        </label>
        <label>
          Contraseña
          <input name="password" type="password" autoComplete="current-password" required />
        </label>

        <button type="submit" className="boton-principal" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      <Link to="/recuperar" className="enlace-centrado">
        ¿Olvidaste tu contraseña?
      </Link>
    </PantallaAcceso>
  );
}
