import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { Dialogo } from '../../compartido/ui/Dialogo.jsx';
import { PasswordUnaVez } from '../../compartido/ui/PasswordUnaVez.jsx';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';
import { FormularioConductor } from './FormularioConductor.jsx';

const NUEVO = { usuario: '', nombre: '', cedula: '', telefono: '', busetaId: null, activo: true };

export function PaginaConductores() {
  const { datos, error, cargando, recargar } = useDatos('/conductores');
  const solicitudes = useDatos('/auth/solicitudes');
  const pidieronRecuperar = new Set(solicitudes.datos?.solicitudes.map((s) => s.usuarioId));
  const [editando, setEditando] = useState(null);
  // { usuario, password } recién generados, para mostrarlos una sola vez.
  const [credenciales, setCredenciales] = useState(null);
  const restablecer = useEnvio();

  async function restablecerPassword(conductor) {
    if (!window.confirm(`¿Generar una contraseña nueva para ${conductor.nombre}? La actual dejará de funcionar.`)) {
      return;
    }
    const r = await restablecer.enviar(() =>
      api(`/conductores/${conductor.id}/restablecer-password`, { method: 'POST' }),
    );
    if (r) {
      setCredenciales({ usuario: conductor.usuario, password: r.password });
      recargar();
      solicitudes.recargar();
    }
  }

  return (
    <>
      <div className="titulo-pagina">
        <h1>Conductores</h1>
        <button type="button" className="boton-principal" onClick={() => setEditando(NUEVO)}>
          + Nuevo conductor
        </button>
      </div>

      {(error || restablecer.error) && <p className="error">{error ?? restablecer.error}</p>}
      {cargando && !datos && <p>Cargando…</p>}
      {datos?.conductores.length === 0 && <p className="vacio">Todavía no hay conductores registrados.</p>}

      <ul className="lista">
        {datos?.conductores.map((c) => (
          <li key={c.id} className={c.activo ? 'tarjeta item' : 'tarjeta item inactivo'}>
            <div className="item-principal">
              <h3>
                {c.nombre} {!c.activo && <span className="etiqueta">Inactivo</span>}{' '}
                {pidieronRecuperar.has(c.id) && <span className="etiqueta etiqueta-alerta">🔑 Pidió recuperar</span>}{' '}
                {c.debeCambiarPassword && <span className="etiqueta">Contraseña temporal</span>}
              </h3>
              <p className="detalle">
                Usuario: <code>{c.usuario}</code>
                {c.telefono && ` · Tel: ${c.telefono}`}
              </p>
              <p className="detalle">
                Buseta: {c.busetaPlaca ? `${c.busetaNumeroInterno} · ${c.busetaPlaca}` : 'sin asignar'}
              </p>
            </div>
            <div className="item-acciones">
              <button type="button" className="boton-secundario-oscuro" onClick={() => setEditando(c)}>
                Editar
              </button>
              <button
                type="button"
                className="boton-enlace"
                disabled={restablecer.enviando}
                onClick={() => restablecerPassword(c)}
              >
                Restablecer contraseña
              </button>
            </div>
          </li>
        ))}
      </ul>

      <Dialogo
        abierto={editando !== null}
        titulo={editando?.id ? 'Editar conductor' : 'Nuevo conductor'}
        alCerrar={() => setEditando(null)}
      >
        <FormularioConductor
          inicial={editando}
          alGuardar={(resultado) => {
            setEditando(null);
            if (resultado.password) {
              setCredenciales({ usuario: resultado.conductor.usuario, password: resultado.password });
            }
            recargar();
          }}
        />
      </Dialogo>

      <Dialogo abierto={credenciales !== null} titulo="Datos de acceso" alCerrar={() => setCredenciales(null)}>
        <PasswordUnaVez {...credenciales} alTerminar={() => setCredenciales(null)} />
      </Dialogo>
    </>
  );
}
