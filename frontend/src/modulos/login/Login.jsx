import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { rutaInicio, useSesion } from '../sesion/contexto.js';

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
    <main className="login">
      <form className="tarjeta login-formulario" onSubmit={enviar}>
        <h1>Colectivos del Café</h1>
        <p className="subtitulo">Ingresa con tu usuario</p>

        {aviso && !error && <p className="aviso">{aviso}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

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
    </main>
  );
}
