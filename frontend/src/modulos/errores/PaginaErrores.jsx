import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import './errores.css';

const ORIGEN = {
  servidor: 'Servidor',
  navegador: 'Celular o navegador',
  programada: 'Revisión diaria',
};

const fechaHora = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });

// Errores de la app en producción (del servidor, del navegador de alguien y de
// la revisión diaria). Cuando pasa uno nuevo, al admin le llega un aviso. Se
// marcan resueltos al arreglarlos; si vuelve a pasar, aparece otra vez.
export function PaginaErrores() {
  const [verResueltos, setVerResueltos] = useState(false);
  const { datos, error, cargando, recargar } = useDatos(verResueltos ? '/errores?resueltos=1' : '/errores');
  const [marcando, setMarcando] = useState(null);

  async function resolver(id) {
    setMarcando(id);
    try {
      await api(`/errores/${id}/resuelto`, { method: 'POST' });
      recargar();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setMarcando(null);
    }
  }

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Errores</h1>
          <p className="subtitulo">Lo que ha fallado en la app. Cuando pasa algo nuevo te llega un aviso.</p>
        </div>
      </div>

      <div className="pestanas" role="tablist">
        <button type="button" role="tab" aria-selected={!verResueltos} onClick={() => setVerResueltos(false)}>
          Pendientes{datos?.pendientes ? ` (${datos.pendientes})` : ''}
        </button>
        <button type="button" role="tab" aria-selected={verResueltos} onClick={() => setVerResueltos(true)}>
          Resueltos
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {cargando && !datos && <p className="vacio">Cargando…</p>}
      {datos && datos.errores.length === 0 && (
        <p className="vacio">{verResueltos ? 'No hay errores resueltos en los últimos 90 días.' : '✓ Nada pendiente: la app está funcionando bien.'}</p>
      )}

      <ul className="errores-lista">
        {datos?.errores.map((e) => (
          <li key={e.id} className="errores-item">
            <div className="errores-cabeza">
              <span className="etiqueta">{ORIGEN[e.origen]}</span>
              {e.veces > 1 && <span className="etiqueta etiqueta-oscura">{e.veces} veces</span>}
            </div>
            <strong className="errores-mensaje">{e.mensaje}</strong>
            <dl className="errores-datos">
              {e.ruta && (
                <div>
                  <dt>Dónde</dt>
                  <dd>{e.ruta}</dd>
                </div>
              )}
              <div>
                <dt>Última vez</dt>
                <dd>{fechaHora.format(new Date(e.ultimaVez))}</dd>
              </div>
              {e.veces > 1 && (
                <div>
                  <dt>Primera vez</dt>
                  <dd>{fechaHora.format(new Date(e.primeraVez))}</dd>
                </div>
              )}
              {e.usuario && (
                <div>
                  <dt>Le pasó a</dt>
                  <dd>{e.usuario}</dd>
                </div>
              )}
            </dl>
            {(e.detalle || e.navegador) && (
              <details className="errores-detalle">
                <summary>Detalle técnico</summary>
                {e.navegador && <p>{e.navegador}</p>}
                {e.detalle && <pre>{e.detalle}</pre>}
              </details>
            )}
            {!e.resueltoEn && (
              <button
                type="button"
                className="boton-secundario-oscuro"
                disabled={marcando === e.id}
                onClick={() => resolver(e.id)}
              >
                {marcando === e.id ? 'Marcando…' : 'Marcar como resuelto'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
