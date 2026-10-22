import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../compartido/api.js';
import { CampoTexto } from '../../compartido/ui/Campos.jsx';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';

// "Olvidé mi contraseña": deja una solicitud que el admin atiende con una contraseña temporal.
export function Recuperar() {
  const [usuario, setUsuario] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const { enviando, error, campos, enviar } = useEnvio();

  async function enviarSolicitud(evento) {
    evento.preventDefault();
    const r = await enviar(() => api('/auth/recuperar', { method: 'POST', cuerpo: { usuario } }));
    if (r) setMensaje(r.mensaje);
  }

  return (
    <main className="login">
      <form className="tarjeta login-formulario" onSubmit={enviarSolicitud} noValidate>
        <h1>Recuperar contraseña</h1>

        {mensaje ? (
          <>
            <p className="ok">{mensaje}</p>
            <p className="ayuda">
              Cuando la recibas, entra con ella y el sistema te pedirá crear una contraseña nueva. Vence en 48
              horas.
            </p>
          </>
        ) : (
          <>
            <p className="subtitulo">
              Escribe tu usuario. El administrador recibirá tu solicitud y te enviará una contraseña temporal.
            </p>
            {error && <p className="error">{error}</p>}
            <CampoTexto
              etiqueta="Usuario"
              valor={usuario}
              alCambiar={setUsuario}
              error={campos.usuario}
              autoComplete="username"
              autoCapitalize="none"
              required
            />
            <button type="submit" className="boton-principal" disabled={enviando || !usuario.trim()}>
              {enviando ? 'Enviando…' : 'Pedir contraseña temporal'}
            </button>
          </>
        )}

        <Link to="/login" className="enlace-centrado">
          Volver a ingresar
        </Link>
      </form>
    </main>
  );
}
