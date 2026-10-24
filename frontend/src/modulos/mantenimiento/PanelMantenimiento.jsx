import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { useSesion } from '../../compartido/sesion/contexto.js';
import { Dialogo } from '../../compartido/ui/Dialogo.jsx';
import { fecha, kilometros } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';
import { EstadoMantenimiento } from './EstadoMantenimiento.jsx';
import { FormularioKilometraje } from './FormularioKilometraje.jsx';
import { FormularioMantenimiento } from './FormularioMantenimiento.jsx';
import { requiereAtencion, textoEstado } from './proximo.js';
import './mantenimiento.css';

// Kilometraje, estado de cada mantenimiento e historial de una buseta.
// Lo usan el conductor (Mi buseta) y el admin (hoja de vida). Los permisos los
// decide el backend: cada registro trae `editable`.
// `accionFija`: en celular, "Registrar kilometraje" va en la barra negra de abajo.
export function PanelMantenimiento({ busetaId, accionFija = false, resumido = false }) {
  const ruta = `/mantenimiento/${busetaId}`;
  const consulta = useDatos(ruta);
  // Cada cambio devuelve la hoja completa: se muestra sin volver a pedirla.
  const [actualizada, setActualizada] = useState(null);
  const hoja = actualizada?.ruta === ruta ? actualizada.hoja : consulta.datos;
  const [dialogo, setDialogo] = useState(null); // { tipo: 'km' } | { tipo: 'registro', inicial }
  const borrado = useEnvio();
  const { usuario } = useSesion();

  const alGuardar = (nueva) => {
    setActualizada({ ruta, hoja: nueva });
    setDialogo(null);
  };

  async function borrar(que, id, pregunta) {
    if (!window.confirm(pregunta)) return;
    const nueva = await borrado.enviar(() => api(`${ruta}/${que}/${id}`, { method: 'DELETE' }));
    if (nueva) setActualizada({ ruta, hoja: nueva });
  }

  if (consulta.error) return <p className="error">{consulta.error}</p>;
  if (!hoja) return <p className="vacio">Cargando mantenimiento…</p>;

  const alertas = hoja.estados.filter(requiereAtencion).sort((a, b) => (b.estado === 'vencido') - (a.estado === 'vencido'));
  const nuevoRegistro = (tipo) => setDialogo({ tipo: 'registro', inicial: { tipo } });
  // Resumido (inicio del conductor): los tipos nunca registrados van en una sola
  // lista corta en vez de una tarjeta cada uno, y las alertas ya se muestran arriba.
  const sinRegistro = resumido ? hoja.estados.filter((e) => e.estado === 'sin_registro') : [];
  const conTarjeta = resumido ? hoja.estados.filter((e) => e.estado !== 'sin_registro') : hoja.estados;

  return (
    <>
      <section className="seccion">
        <h2>Mantenimiento</h2>

        <div className="mantenimiento-km tarjeta">
          <div>
            <span className="mantenimiento-rotulo">Kilometraje actual</span>
            <p className="mantenimiento-km-valor">{hoja.kilometraje ? kilometros(hoja.kilometraje.actual) : 'Sin reportar'}</p>
            <p className="detalle">
              {hoja.kilometraje
                ? `Último reporte: ${fecha(hoja.kilometraje.fecha)}`
                : 'Repórtalo al menos una vez por semana para saber cuándo toca cada cambio.'}
            </p>
          </div>
          <div className="mantenimiento-km-acciones">
            <button
              type="button"
              className={accionFija ? 'boton-principal accion-fija' : 'boton-principal'}
              onClick={() => setDialogo({ tipo: 'km' })}
            >
              Registrar kilometraje
            </button>
            <button type="button" className="boton-secundario-oscuro" onClick={() => nuevoRegistro(undefined)}>
              + Registrar mantenimiento
            </button>
          </div>
        </div>

        {!resumido && alertas.length > 0 && (
          <div className="aviso mantenimiento-alerta" role="alert">
            {alertas.map((e) => (
              <p key={e.tipo}>
                <span aria-hidden="true">{e.estado === 'vencido' ? '⛔' : '⚠️'}</span> <strong>{e.nombre}.</strong>{' '}
                {textoEstado(e)}.
              </p>
            ))}
          </div>
        )}

        {conTarjeta.length > 0 && (
          <div className="mantenimiento-estados">
            {conTarjeta.map((e) => (
              <article key={e.tipo} className="tarjeta mantenimiento-estado">
                <h3>{e.nombre}</h3>
                {e.ultimo ? (
                  <>
                    <p className="detalle">
                      Último: {fecha(e.ultimo.fecha)}
                      {e.ultimo.kilometraje != null && ` · ${kilometros(e.ultimo.kilometraje)}`}
                    </p>
                    <p className="detalle">Próximo: {textoProximo(e.ultimo)}</p>
                  </>
                ) : (
                  <p className="detalle">Todavía no se ha registrado.</p>
                )}
                <div className="mantenimiento-estado-pie">
                  <EstadoMantenimiento estado={e} compacto={e.estado === 'sin_registro'} />
                  <button type="button" className="boton-enlace" onClick={() => nuevoRegistro(e.tipo)}>
                    Registrar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {sinRegistro.length > 0 && (
          <div className="mantenimiento-sin-registro">
            <p>
              <strong>Sin registro todavía.</strong> Cuando hagas alguno, regístralo para saber cuándo toca el siguiente:
            </p>
            <div className="mantenimiento-sin-registro-tipos">
              {sinRegistro.map((e) => (
                <button key={e.tipo} type="button" className="etiqueta" onClick={() => nuevoRegistro(e.tipo)}>
                  + {e.nombre}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="seccion">
        <h2>Historial de mantenimientos</h2>
        {borrado.error && <p className="error">{borrado.error}</p>}
        {hoja.registros.length === 0 ? (
          <p className="vacio">Aún no hay mantenimientos registrados.</p>
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Mantenimiento</th>
                  <th>Kilometraje</th>
                  <th>Próximo</th>
                  <th>Registró</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {hoja.registros.map((r) => (
                  <tr key={r.id}>
                    <td className="numero">{fecha(r.fecha)}</td>
                    <td>
                      <strong>{r.tipoNombre}</strong>
                      {r.observacion && <span className="mantenimiento-observacion">{r.observacion}</span>}
                    </td>
                    <td className="numero" data-etiqueta="Km:">{kilometros(r.kilometraje)}</td>
                    <td data-etiqueta="Próximo:">{textoProximo(r)}</td>
                    <td data-etiqueta="Registró:">{r.registradoPor.nombre}</td>
                    <td>
                      {r.editable && (
                        <span className="mantenimiento-acciones">
                          <button type="button" className="boton-enlace" onClick={() => setDialogo({ tipo: 'registro', inicial: r })}>
                            Editar
                          </button>
                          <button
                            type="button"
                            className="boton-enlace"
                            disabled={borrado.enviando}
                            onClick={() => borrar('registros', r.id, `¿Borrar el registro de ${r.tipoNombre} del ${fecha(r.fecha)}?`)}
                          >
                            Borrar
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {usuario.rol === 'conductor' && (
          <p className="ayuda">
            Lo que registras lo puedes corregir o borrar durante {hoja.diasEdicion} días. Después, pídeselo al
            administrador.
          </p>
        )}

        {hoja.lecturas.length > 0 && (
          <details className="mantenimiento-lecturas">
            <summary>Últimos reportes de kilometraje</summary>
            <ul>
              {hoja.lecturas.map((l) => (
                <li key={l.id}>
                  <span className="numero">{fecha(l.fecha)}</span>
                  <strong className="numero">{kilometros(l.kilometraje)}</strong>
                  <span className="detalle">{l.registradoPor.nombre}</span>
                  {l.editable && (
                    <button
                      type="button"
                      className="boton-enlace"
                      disabled={borrado.enviando}
                      onClick={() => borrar('kilometraje', l.id, `¿Borrar el kilometraje del ${fecha(l.fecha)}?`)}
                    >
                      Borrar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <Dialogo abierto={dialogo?.tipo === 'km'} titulo="Registrar kilometraje" alCerrar={() => setDialogo(null)}>
        <FormularioKilometraje busetaId={busetaId} actual={hoja.kilometraje} alGuardar={alGuardar} />
      </Dialogo>

      <Dialogo
        abierto={dialogo?.tipo === 'registro'}
        titulo={dialogo?.inicial?.id ? 'Corregir mantenimiento' : 'Registrar mantenimiento'}
        alCerrar={() => setDialogo(null)}
      >
        {dialogo?.tipo === 'registro' && (
          <FormularioMantenimiento
            busetaId={busetaId}
            tipos={hoja.tipos}
            kmActual={hoja.kilometraje?.actual}
            inicial={dialogo.inicial}
            alGuardar={alGuardar}
          />
        )}
      </Dialogo>
    </>
  );
}

function textoProximo({ proximoKm, proximaFecha }) {
  const partes = [proximoKm != null && kilometros(proximoKm), proximaFecha && fecha(proximaFecha)].filter(Boolean);
  return partes.length ? partes.join(' o ') : 'Sin programar';
}
