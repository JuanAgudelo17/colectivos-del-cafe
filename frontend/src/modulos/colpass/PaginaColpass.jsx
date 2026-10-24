import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { CampoSeleccion, CampoTexto } from '../../compartido/ui/Campos.jsx';
import { Dialogo } from '../../compartido/ui/Dialogo.jsx';
import { fecha, hoyBogota, pesos } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';
import { ConsultaPeajes, TotalPendiente } from './ConsultaPeajes.jsx';
import './colpass.css';

const inicioDelMes = () => `${hoyBogota().slice(0, 8)}01`;

// Por qué no se puede liquidar el rango consultado (el backend lo valida igual).
function motivoNoLiquidar({ consulta, colpass }) {
  if (consulta.desde < colpass.desde) return `Para liquidar, empieza desde el ${fecha(colpass.desde)} (inicio del Colpass).`;
  if (consulta.liquidado > 0) return 'El rango incluye días ya liquidados: usa "Ver los días pendientes".';
  if (consulta.porLiquidar === 0) return 'No hay peajes por liquidar en esas fechas.';
  return null;
}

// Admin: busetas con Colpass, cuánto tiene guardado cada conductor y las
// liquidaciones (el conductor le entrega al admin la plata de los peajes de
// unos días; el valor sale de la columna Peajes del producido).
export function PaginaColpass() {
  const lista = useDatos('/colpass');
  const [elegida, setElegida] = useState(null);
  const [rango, setRango] = useState(() => ({ desde: inicioDelMes(), hasta: hoyBogota() }));
  const [dialogo, setDialogo] = useState(null); // 'activar' | 'liquidar' | null

  const busetas = lista.datos?.busetas ?? [];
  const conColpass = busetas.filter((b) => b.colpass);
  const busetaId = conColpass.some((b) => b.id === elegida) ? elegida : (conColpass[0]?.id ?? null);
  const consulta = `/colpass/${busetaId}?desde=${rango.desde}&hasta=${rango.hasta}`;
  const detalle = useDatos(busetaId ? consulta : null);
  const datos = detalle.datos?.buseta.id === busetaId ? detalle.datos : null;

  const recargar = () => {
    lista.recargar();
    detalle.recargar();
  };
  const cerrar = () => setDialogo(null);

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Colpass</h1>
          <p className="subtitulo">Plata de peajes que guardan los conductores de busetas con Colpass.</p>
        </div>
        <button
          type="button"
          className="boton-secundario-oscuro"
          disabled={!lista.datos}
          onClick={() => setDialogo('activar')}
        >
          Activar Colpass
        </button>
      </div>

      {lista.error && <p className="error">{lista.error}</p>}
      {lista.datos && conColpass.length === 0 && (
        <p className="vacio">Ninguna buseta tiene Colpass todavía. Actívalo en la que lo use.</p>
      )}

      {conColpass.length > 0 && (
        <div className="colpass-busetas" role="list">
          {conColpass.map((b) => (
            <button
              key={b.id}
              type="button"
              role="listitem"
              className={b.id === busetaId ? 'colpass-buseta colpass-buseta-activa' : 'colpass-buseta'}
              aria-pressed={b.id === busetaId}
              onClick={() => setElegida(b.id)}
            >
              <strong>
                {b.numeroInterno} · {b.placa}
              </strong>
              <small>{b.conductor ?? 'Sin conductor'}</small>
              <span>
                Por liquidar <strong>{pesos(b.pendiente.total)}</strong>
              </span>
            </button>
          ))}
        </div>
      )}

      {detalle.error && <p className="error">{detalle.error}</p>}

      {datos && (
        <>
          <div className="colpass-encabezado">
            <TotalPendiente
              pendiente={datos.pendiente}
              texto={`Por liquidar · ${datos.buseta.conductor ?? 'sin conductor'}`}
            />
            {datos.pendiente.dias > 0 && (
              <button
                type="button"
                className="boton-enlace"
                onClick={() => setRango({ desde: datos.pendiente.desde, hasta: datos.pendiente.hasta })}
              >
                Ver los días pendientes
              </button>
            )}
          </div>

          <div className="colpass-cuerpo">
            <div>
              <ConsultaPeajes detalle={datos} rango={rango} alCambiarRango={setRango} />
              {motivoNoLiquidar(datos) && <p className="colpass-nota">{motivoNoLiquidar(datos)}</p>}
              <button
                type="button"
                className="boton-principal accion-fija colpass-liquidar"
                disabled={Boolean(motivoNoLiquidar(datos))}
                onClick={() => setDialogo('liquidar')}
              >
                Liquidar {pesos(datos.consulta.porLiquidar)}
              </button>
            </div>

            <Liquidaciones datos={datos} alActualizar={recargar} />
          </div>

          <QuitarColpass buseta={datos.buseta} alQuitar={recargar} />
        </>
      )}

      <Dialogo abierto={dialogo === 'activar'} titulo="Activar Colpass" alCerrar={cerrar}>
        <ActivarColpass
          busetas={busetas}
          alGuardar={(id) => {
            cerrar();
            setElegida(id);
            recargar();
          }}
        />
      </Dialogo>

      <Dialogo abierto={dialogo === 'liquidar'} titulo="Registrar liquidación" alCerrar={cerrar}>
        {datos && (
          <Liquidar
            datos={datos}
            alGuardar={() => {
              cerrar();
              recargar();
            }}
          />
        )}
      </Dialogo>
    </>
  );
}

function ActivarColpass({ busetas, alGuardar }) {
  const [busetaId, setBusetaId] = useState(busetas.find((b) => !b.colpass)?.id ?? busetas[0]?.id ?? null);
  const [desde, setDesde] = useState(hoyBogota());
  const { enviando, error, campos, enviar } = useEnvio();
  const actual = busetas.find((b) => b.id === busetaId)?.colpass;

  async function guardar(e) {
    e.preventDefault();
    const r = await enviar(() => api(`/colpass/${busetaId}`, { method: 'PUT', cuerpo: { desde } }));
    if (r) alGuardar(busetaId);
  }

  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      {error && <p className="error">{error}</p>}
      <CampoSeleccion
        etiqueta="Buseta"
        valor={busetaId}
        alCambiar={setBusetaId}
        opciones={busetas.map((b) => ({
          valor: b.id,
          texto: `${b.numeroInterno} · ${b.placa}${b.colpass ? ' (ya tiene)' : ''}`,
        }))}
      />
      <CampoTexto
        etiqueta="Tiene Colpass desde"
        type="date"
        max={hoyBogota()}
        valor={desde}
        alCambiar={setDesde}
        error={campos.desde}
        ayuda={
          actual
            ? `Hoy dice desde el ${fecha(actual.desde)}; se cambiará.`
            : 'Antes de esta fecha los peajes se pagaban en efectivo: no quedan por liquidar.'
        }
      />
      <div className="acciones">
        <button type="submit" className="boton-principal" disabled={enviando || !busetaId || !desde}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

// Confirma la liquidación del rango consultado: el conductor entrega esa plata.
function Liquidar({ datos, alGuardar }) {
  const [observacion, setObservacion] = useState('');
  const { enviando, error, enviar } = useEnvio();
  const { desde, hasta, porLiquidar } = datos.consulta;

  async function guardar(e) {
    e.preventDefault();
    const r = await enviar(() =>
      api(`/colpass/${datos.buseta.id}/liquidaciones`, { method: 'POST', cuerpo: { desde, hasta, observacion } }),
    );
    if (r) alGuardar();
  }

  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      {error && <p className="error">{error}</p>}
      <p className="colpass-confirmar">
        {datos.buseta.conductor ?? 'El conductor'} entrega <strong>{pesos(porLiquidar)}</strong> de los peajes
        del {fecha(desde)} al {fecha(hasta)} ({datos.buseta.numeroInterno}).
      </p>
      <CampoTexto
        etiqueta="Nota (opcional)"
        valor={observacion}
        alCambiar={setObservacion}
        placeholder="Ej: entregó en efectivo"
        maxLength={200}
      />
      <div className="acciones">
        <button type="submit" className="boton-principal" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Liquidar'}
        </button>
      </div>
    </form>
  );
}

function Liquidaciones({ datos, alActualizar }) {
  const { enviando, error, enviar } = useEnvio();

  async function quitar(l) {
    if (!window.confirm(`¿Quitar la liquidación de ${pesos(l.valor)}? Esos días vuelven a quedar por liquidar.`)) return;
    const r = await enviar(() => api(`/colpass/${datos.buseta.id}/liquidaciones/${l.id}`, { method: 'DELETE' }));
    if (r) alActualizar();
  }

  return (
    <section aria-labelledby="titulo-liquidaciones">
      <h2 id="titulo-liquidaciones">Liquidaciones</h2>
      {error && <p className="error">{error}</p>}
      {datos.liquidaciones.length === 0 ? (
        <p className="vacio">Todavía no hay liquidaciones.</p>
      ) : (
        <ul className="colpass-liquidaciones">
          {datos.liquidaciones.map((l) => (
            <li key={l.id}>
              <strong>{pesos(l.valor)}</strong>
              <span>
                Peajes del {fecha(l.desde)} al {fecha(l.hasta)}
              </span>
              {l.observacion && <small>{l.observacion}</small>}
              {l.valorActual !== l.valor && (
                <span className="documento documento-por_vencer">
                  <span aria-hidden="true">⚠️</span> Se corrigió el producido: hoy esos días suman{' '}
                  {pesos(l.valorActual)}
                </span>
              )}
              <button type="button" className="boton-enlace" disabled={enviando} onClick={() => quitar(l)}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="colpass-nota">Colpass desde el {fecha(datos.colpass.desde)}.</p>
    </section>
  );
}

function QuitarColpass({ buseta, alQuitar }) {
  const { enviando, error, enviar } = useEnvio();

  async function quitar() {
    if (!window.confirm(`¿Quitar el Colpass de la ${buseta.numeroInterno}? Las liquidaciones hechas se conservan.`)) {
      return;
    }
    const r = await enviar(() => api(`/colpass/${buseta.id}`, { method: 'DELETE' }).then(() => true));
    if (r) alQuitar();
  }

  return (
    <div className="colpass-quitar">
      {error && <p className="error">{error}</p>}
      <button type="button" className="boton-enlace" disabled={enviando} onClick={quitar}>
        Quitar el Colpass de la {buseta.numeroInterno}
      </button>
    </div>
  );
}
