import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { Dialogo } from '../../compartido/ui/Dialogo.jsx';
import { PasswordUnaVez } from '../../compartido/ui/PasswordUnaVez.jsx';
import { Pestanas } from '../../compartido/ui/Pestanas.jsx';
import { FILTROS_ACTIVO, opcionesActivo } from '../../compartido/utilidades/filtros.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';
import { FormularioConductor } from './FormularioConductor.jsx';

const NUEVO = { usuario: '', nombre: '', cedula: '', telefono: '', busetaId: null, activo: true };

export function PaginaConductores() {
  const { datos, error, cargando, recargar } = useDatos('/conductores');
  const solicitudes = useDatos('/auth/solicitudes');
  const pidieronRecuperar = new Set(solicitudes.datos?.solicitudes.map((s) => s.usuarioId));
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState('activos');
  // { usuario, password } recién generados, para mostrarlos una sola vez.
  const [credenciales, setCredenciales] = useState(null);
  const restablecer = useEnvio();
  const conductores = datos?.conductores.filter(FILTROS_ACTIVO[filtro]);

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
        <div>
          <h1>Conductores</h1>
          <p className="subtitulo">Cuentas de acceso, datos de contacto y buseta asignada.</p>
        </div>
        <button type="button" className="boton-principal accion-fija" onClick={() => setEditando(NUEVO)}>
          + Nuevo conductor
        </button>
      </div>

      <Pestanas
        etiqueta="Filtrar conductores"
        opciones={opcionesActivo(datos?.conductores)}
        valor={filtro}
        alCambiar={setFiltro}
      />

      {(error || restablecer.error) && <p className="error">{error ?? restablecer.error}</p>}
      {cargando && !datos && <p className="vacio">Cargando…</p>}
      {conductores?.length === 0 && (
        <p className="vacio">
          {datos.conductores.length === 0
            ? 'Todavía no hay conductores registrados.'
            : 'No hay conductores en este filtro.'}
        </p>
      )}

      <ul className="lista">
        {conductores?.map((c) => (
          <li key={c.id} className={c.activo ? 'tarjeta item' : 'tarjeta item inactivo'}>
            <div className="item-principal">
              {(!c.activo || pidieronRecuperar.has(c.id) || c.debeCambiarPassword) && (
                <div className="etiquetas">
                  {!c.activo && <span className="etiqueta etiqueta-oscura">Inactivo</span>}
                  {pidieronRecuperar.has(c.id) && (
                    <span className="etiqueta etiqueta-alerta">🔑 Pidió recuperar contraseña</span>
                  )}
                  {c.debeCambiarPassword && <span className="etiqueta">Contraseña temporal</span>}
                </div>
              )}
              <h3>{c.nombre}</h3>
              <p className="detalle">
                Usuario <code>{c.usuario}</code>
              </p>
              <p className="detalle">
                Buseta: {c.busetaPlaca ? `${c.busetaNumeroInterno} · ${c.busetaPlaca}` : 'sin asignar'}
              </p>
              {c.telefono && <p className="detalle">Tel. {c.telefono}</p>}
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
