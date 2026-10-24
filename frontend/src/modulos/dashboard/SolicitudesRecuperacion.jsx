import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { Dialogo } from '../../compartido/ui/Dialogo.jsx';
import { PasswordUnaVez } from '../../compartido/ui/PasswordUnaVez.jsx';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';

const formatoHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  dateStyle: 'medium',
  timeStyle: 'short',
});

// Conductores que pidieron "olvidé mi contraseña". Solo aparece si hay pendientes.
// Las solicitudes llegan con el panel; alAtender lo recarga.
export function SolicitudesRecuperacion({ solicitudes, alAtender }) {
  const [credenciales, setCredenciales] = useState(null);
  const { enviando, error, enviar } = useEnvio();

  async function generar(s) {
    const r = await enviar(() => api(`/conductores/${s.usuarioId}/restablecer-password`, { method: 'POST' }));
    if (r) {
      setCredenciales({ usuario: s.usuario, password: r.password });
      alAtender();
    }
  }

  if (solicitudes.length === 0 && !credenciales) return null;

  return (
    <section className="tarjeta solicitudes">
      <h2>
        {solicitudes.length === 0
          ? 'Solicitudes de recuperación atendidas'
          : solicitudes.length === 1
            ? '1 conductor pidió recuperar su contraseña'
            : `${solicitudes.length} conductores pidieron recuperar su contraseña`}
      </h2>
      {error && <p className="error">{error}</p>}
      <ul className="lista-solicitudes">
        {solicitudes.map((s) => (
          <li key={s.id}>
            <div>
              <strong>{s.nombre}</strong> · <code>{s.usuario}</code>
              <p className="detalle">
                {formatoHora.format(new Date(s.creadoEn))}
                {s.telefono && ` · Tel. ${s.telefono}`}
              </p>
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
