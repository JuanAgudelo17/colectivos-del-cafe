import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { PantallaAcceso } from '../../compartido/layout/PantallaAcceso.jsx';
import { rutaInicio, useSesion } from '../../compartido/sesion/contexto.js';
import { CampoPassword, CampoTexto } from '../../compartido/ui/Campos.jsx';
import { Icono } from '../../compartido/ui/Iconos.jsx';
import { horaBogota } from '../../compartido/utilidades/formato.js';
import { guardarUltimoUsuario, leerUltimoUsuario, olvidarUltimoUsuario } from './ultimoUsuario.js';

function saludo(hora) {
  if (hora >= 5 && hora < 12) return 'Buenos días';
  return hora >= 12 && hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}

// En celular no se enfoca solo: el teclado taparía la pantalla apenas abre.
const enfocarAlAbrir = () => window.matchMedia('(min-width: 861px)').matches;

export function Login() {
  const { usuario: sesion, cargando, aviso, iniciarSesion } = useSesion();
  const navegar = useNavigate();
  const [recordado, setRecordado] = useState(leerUltimoUsuario);
  const [usuario, setUsuario] = useState(() => recordado?.usuario ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const campoUsuario = useRef(null);
  const campoPassword = useRef(null);

  if (cargando) return <p className="cargando">Cargando…</p>;
  if (sesion) return <Navigate to={rutaInicio(sesion)} replace />;

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const entro = await iniciarSesion(usuario, password);
      guardarUltimoUsuario(entro);
      navegar(rutaInicio(entro), { replace: true });
    } catch (err) {
      setError(err.message);
      setEnviando(false);
      // Contraseña equivocada: se borra para escribirla de nuevo.
      if (err.status === 401) {
        setPassword('');
        campoPassword.current?.focus();
      }
    }
  }

  function noSoyYo() {
    olvidarUltimoUsuario();
    setRecordado(null);
    setUsuario('');
    setPassword('');
    setError(null);
    // Después de que se pinte el campo de usuario.
    requestAnimationFrame(() => campoUsuario.current?.focus());
  }

  return (
    <PantallaAcceso>
      <p className="acceso-saludo">{saludo(horaBogota())}</p>
      <h1>{recordado ? `Hola de nuevo, ${recordado.nombre}` : 'Tu buseta, tus cuentas.'}</h1>
      <p className="subtitulo">
        {recordado
          ? 'Escribe tu contraseña para continuar.'
          : 'Entra para ver tu producido y los documentos de tu buseta.'}
      </p>

      {aviso && !error && <p className="aviso">{aviso}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={enviar}>
        {recordado ? (
          <p className="acceso-recordado">
            <span className="acceso-avatar" aria-hidden="true">
              {recordado.nombre[0]?.toUpperCase()}
            </span>
            <span>
              Entrarás como <strong>{recordado.usuario}</strong>
            </span>
            <button type="button" className="boton-enlace" onClick={noSoyYo}>
              ¿No eres tú?
            </button>
            {/* Para que el gestor de contraseñas sepa de qué usuario es */}
            <input type="text" name="usuario" autoComplete="username" value={usuario} readOnly hidden />
          </p>
        ) : (
          <CampoTexto
            etiqueta="Usuario"
            name="usuario"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            valor={usuario}
            alCambiar={setUsuario}
            ref={campoUsuario}
            autoFocus={enfocarAlAbrir()}
            required
          />
        )}
        <CampoPassword
          etiqueta="Contraseña"
          name="password"
          autoComplete="current-password"
          valor={password}
          alCambiar={setPassword}
          ref={campoPassword}
          autoFocus={Boolean(recordado) && enfocarAlAbrir()}
          required
        />

        <button type="submit" className="boton-principal" disabled={enviando}>
          {enviando ? (
            <>
              <span className="girando" aria-hidden="true" /> Ingresando…
            </>
          ) : (
            <>
              Ingresar <Icono nombre="flecha" />
            </>
          )}
        </button>
      </form>

      <Link to="/recuperar" className="enlace-centrado">
        ¿Olvidaste tu contraseña?
      </Link>
    </PantallaAcceso>
  );
}
