import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { Dialogo } from '../../compartido/ui/Dialogo.jsx';
import { PasswordUnaVez } from '../../compartido/ui/PasswordUnaVez.jsx';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';

const formatoHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  dateStyle: 'medium',
  timeStyle: 'short',
});

// Conductores que pidieron "olvidé mi contraseña". Solo aparece si hay pendientes.
export function SolicitudesRecuperacion() {
  const { datos, recargar } = useDatos('/auth/solicitudes');
  const [credenciales, setCredenciales] = useState(null);
  const { enviando, error, enviar } = useEnvio();
  const solicitudes = datos?.solicitudes ?? [];

  async function generar(s) {
    const r = await enviar(() => api(`/conductores/${s.usuarioId}/restablecer-password`, { method: 'POST' }));
    if (r) {
      setCredenciales({ usuario: s.usuario, password: r.password });
      recargar();
    }
  }

  if (solicitudes.length === 0 && !credenciales) return null;

  return (
    <section className="tarjeta solicitudes">
      <h2>🔑 Solicitudes de recuperación de contraseña</h2>
      {error && <p className="error">{error}</p>}
      <ul className="lista-solicitudes">
        {solicitudes.map((s) => (
          <li key={s.id}>
            <div>
              <strong>{s.nombre}</strong> · <code>{s.usuario}</code>
              <span className="detalle">
                {' '}
                · {formatoHora.format(new Date(s.creadoEn))}
                {s.telefono && ` · Tel: ${s.telefono}`}
              </span>
            </div>
            <button type="button" className="boton-principal" disabled={enviando} onClick={() => generar(s)}>
              Generar contraseña temporal
            </button>
          </li>
        ))}
      </ul>

      <Dialogo abierto={credenciales !== null} titulo="Contraseña temporal" alCerrar={() => setCredenciales(null)}>
        <PasswordUnaVez {...credenciales} alTerminar={() => setCredenciales(null)} />
      </Dialogo>
    </section>
  );
}
