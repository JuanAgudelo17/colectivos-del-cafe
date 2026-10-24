import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../compartido/api.js';
import { PantallaAcceso } from '../../compartido/layout/PantallaAcceso.jsx';
import { rutaInicio, useSesion } from '../../compartido/sesion/contexto.js';
import { CampoPassword } from '../../compartido/ui/Campos.jsx';
import { IlustracionLlave } from '../../compartido/ui/Ilustraciones.jsx';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';
import './cuenta.css';

// Mismas reglas que valida el backend (compartido/seguridad/passwords.js).
const REGLAS = [
  ['Al menos 8 caracteres', (v) => v.length >= 8],
  ['Al menos una letra', (v) => /\p{L}/u.test(v)],
  ['Al menos un número', (v) => /\d/.test(v)],
];

// Crear la contraseña propia: obligatorio tras una contraseña temporal,
// o voluntario desde el menú.
export function CambiarPassword() {
  const { usuario, actualizarUsuario } = useSesion();
  const navegar = useNavigate();
  const [datos, setDatos] = useState({ actual: '', nueva: '', confirmar: '' });
  const { enviando, error, campos, enviar } = useEnvio();
  const obligatorio = usuario.debeCambiarPassword;
  const cambiar = (campo) => (valor) => setDatos((d) => ({ ...d, [campo]: valor }));

  const noCoinciden = datos.confirmar !== '' && datos.confirmar !== datos.nueva;
  const cumpleReglas = REGLAS.every(([, ok]) => ok(datos.nueva));

  async function guardar(evento) {
    evento.preventDefault();
    if (noCoinciden || !cumpleReglas) return;
    const r = await enviar(() =>
      api('/auth/cambiar-password', { method: 'POST', cuerpo: { actual: datos.actual, nueva: datos.nueva } }),
    );
    if (r) {
      actualizarUsuario(r.usuario);
      navegar(rutaInicio(r.usuario), { replace: true, state: { passwordCambiada: true } });
    }
  }

  return (
    <PantallaAcceso ilustracion={<IlustracionLlave />}>
      <h1>{obligatorio ? 'Crea tu contraseña' : 'Cambiar contraseña'}</h1>
      <p className="subtitulo">
        {obligatorio
          ? `Hola, ${usuario.nombre.split(' ')[0]}. Entraste con una contraseña temporal; crea una propia que solo tú conozcas.`
          : 'Al cambiarla se cierran tus sesiones abiertas en otros dispositivos.'}
      </p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={guardar} noValidate>
        <CampoPassword
          etiqueta={obligatorio ? 'Contraseña temporal' : 'Contraseña actual'}
          autoComplete="current-password"
          valor={datos.actual}
          alCambiar={cambiar('actual')}
          error={campos.actual}
          required
        />
        <CampoPassword
          etiqueta="Contraseña nueva"
          autoComplete="new-password"
          valor={datos.nueva}
          alCambiar={cambiar('nueva')}
          error={campos.nueva}
          required
        />
        <ul className="reglas" aria-label="Requisitos">
          {REGLAS.map(([texto, ok]) => (
            <li key={texto} className={ok(datos.nueva) ? 'regla-ok' : ''}>
              {ok(datos.nueva) ? '✓' : '·'} {texto}
            </li>
          ))}
        </ul>
        <CampoPassword
          etiqueta="Repite la contraseña nueva"
          autoComplete="new-password"
          valor={datos.confirmar}
          alCambiar={cambiar('confirmar')}
          error={noCoinciden ? 'No coincide con la nueva' : undefined}
          required
        />

        <button
          type="submit"
          className="boton-principal"
          disabled={enviando || !cumpleReglas || noCoinciden || !datos.actual || !datos.confirmar}
        >
          {enviando ? (
            <>
              <span className="girando" aria-hidden="true" /> Guardando…
            </>
          ) : (
            'Guardar contraseña'
          )}
        </button>
      </form>

      {!obligatorio && (
        <Link to={rutaInicio(usuario)} className="enlace-centrado">
          Volver al panel
        </Link>
      )}
    </PantallaAcceso>
  );
}
