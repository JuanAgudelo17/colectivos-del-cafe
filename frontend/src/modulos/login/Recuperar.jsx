import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../compartido/api.js';
import { PantallaAcceso } from '../../compartido/layout/PantallaAcceso.jsx';
import { CampoTexto } from '../../compartido/ui/Campos.jsx';
import { Icono } from '../../compartido/ui/Iconos.jsx';
import { IlustracionLlave } from '../../compartido/ui/Ilustraciones.jsx';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';
import { leerUltimoUsuario } from './ultimoUsuario.js';

const PASOS = [
  ['enviar', 'Pides', 'una contraseña temporal aquí.'],
  ['llave', 'El administrador', 'te la entrega.'],
  ['candado', 'Entras', 'con ella y creas tu propia contraseña.'],
];

// "Olvidé mi contraseña": deja una solicitud que el admin atiende con una contraseña temporal.
export function Recuperar() {
  const [usuario, setUsuario] = useState(() => leerUltimoUsuario()?.usuario ?? '');
  const [mensaje, setMensaje] = useState(null);
  const { enviando, error, campos, enviar } = useEnvio();

  async function enviarSolicitud(evento) {
    evento.preventDefault();
    const r = await enviar(() => api('/auth/recuperar', { method: 'POST', cuerpo: { usuario } }));
    if (r) setMensaje(r.mensaje);
  }

  return (
    <PantallaAcceso ilustracion={<IlustracionLlave />}>
      <h1>Recuperar contraseña</h1>

      <ol className="pasos" aria-label="Cómo funciona">
        {PASOS.map(([icono, quien, que], i) => (
          <li key={icono} className={mensaje && i === 0 ? 'paso-hecho' : undefined}>
            <span className="paso-icono">
              <Icono nombre={mensaje && i === 0 ? 'listo' : icono} />
            </span>
            <span>
              <strong>{quien}</strong> {que}
            </span>
          </li>
        ))}
      </ol>

      {mensaje ? (
        <>
          <p className="aviso">{mensaje}</p>
          <p className="ayuda">La contraseña temporal vence en 48 horas.</p>
        </>
      ) : (
        <>
          {error && <p className="error">{error}</p>}
          <form onSubmit={enviarSolicitud} noValidate>
            <CampoTexto
              etiqueta="Usuario"
              valor={usuario}
              alCambiar={setUsuario}
              error={campos.usuario}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
            <button type="submit" className="boton-principal" disabled={enviando || !usuario.trim()}>
              {enviando ? (
                <>
                  <span className="girando" aria-hidden="true" /> Enviando…
                </>
              ) : (
                <>
                  Pedir contraseña temporal <Icono nombre="enviar" />
                </>
              )}
            </button>
          </form>
        </>
      )}

      <Link to="/login" className="enlace-centrado">
        Volver a ingresar
      </Link>
    </PantallaAcceso>
  );
}
