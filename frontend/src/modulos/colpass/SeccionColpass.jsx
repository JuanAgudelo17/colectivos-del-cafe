import { useEffect, useRef, useState } from 'react';
import { api } from '../../compartido/api.js';
import { CampoTexto } from '../../compartido/ui/Campos.jsx';
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

// Apartado "Peajes Colpass" dentro de Producido (admin), para la buseta elegida.
// Con Colpass: lo que el conductor tiene guardado, consulta por fechas, liquidar
// y las liquidaciones. Sin Colpass: solo un enlace para activarlo.
// `cambio`: cuando cambia (ej. los peajes del mes en la cuadrícula), se recarga.
export function SeccionColpass({ busetaId, cambio }) {
  const [rango, setRango] = useState(() => ({ desde: inicioDelMes(), hasta: hoyBogota() }));
  const [liquidando, setLiquidando] = useState(false);
  const detalle = useDatos(`/colpass/${busetaId}?desde=${rango.desde}&hasta=${rango.hasta}`);
  const { recargar } = detalle;
  const datos = detalle.datos?.buseta.id === busetaId ? detalle.datos : null;

  // Si se corrigen peajes en la cuadrícula, lo pendiente cambia.
  const anterior = useRef(cambio);
  useEffect(() => {
    if (anterior.current !== cambio) recargar();
    anterior.current = cambio;
  }, [cambio, recargar]);

  if (detalle.error) return <p className="error">{detalle.error}</p>;
  if (!datos) return null;

  if (!datos.colpass) {
    return (
      <section className="colpass-seccion colpass-seccion-inactiva" aria-label="Colpass">
        <FechaColpass busetaId={busetaId} alGuardar={recargar} texto="¿Esta buseta usa Colpass? Activarlo" />
      </section>
    );
  }

  const motivo = motivoNoLiquidar(datos);

  return (
    <section className="colpass-seccion" aria-labelledby="titulo-colpass">
      <h2 id="titulo-colpass">Peajes Colpass</h2>
      <p className="subtitulo">
        La empresa le da los peajes al conductor, pero el Colpass los cobra aparte: él guarda esa plata hasta
        entregártela.
      </p>

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
          <ConsultaPeajes detalle={datos} rango={rango} alCambiarRango={setRango} nivel="h3" />
          {motivo && <p className="colpass-nota">{motivo}</p>}
          <button
            type="button"
            className="boton-principal colpass-liquidar"
            disabled={Boolean(motivo)}
            onClick={() => setLiquidando(true)}
          >
            Liquidar {pesos(datos.consulta.porLiquidar)}
          </button>
        </div>

        <Liquidaciones datos={datos} alActualizar={recargar} />
      </div>

      <div className="colpass-ajustes">
        <FechaColpass
          busetaId={busetaId}
          actual={datos.colpass.desde}
          alGuardar={recargar}
          texto={`Colpass desde el ${fecha(datos.colpass.desde)} · Cambiar`}
        />
        <QuitarColpass buseta={datos.buseta} alQuitar={recargar} />
      </div>

      <Dialogo abierto={liquidando} titulo="Registrar liquidación" alCerrar={() => setLiquidando(false)}>
        <Liquidar
          datos={datos}
          alGuardar={() => {
            setLiquidando(false);
            recargar();
          }}
        />
      </Dialogo>
    </section>
  );
}

// Activar el Colpass o cambiar desde cuándo lo tiene (formulario corto en línea).
function FechaColpass({ busetaId, actual, texto, alGuardar }) {
  const [abierto, setAbierto] = useState(false);
  const [desde, setDesde] = useState(actual ?? hoyBogota());
  const { enviando, error, campos, enviar } = useEnvio();

  async function guardar(e) {
    e.preventDefault();
    const r = await enviar(() => api(`/colpass/${busetaId}`, { method: 'PUT', cuerpo: { desde } }));
    if (r) {
      setAbierto(false);
      alGuardar();
    }
  }

  if (!abierto) {
    return (
      <button type="button" className="boton-enlace" onClick={() => setAbierto(true)}>
        {texto}
      </button>
    );
  }

  return (
    <form className="formulario colpass-fecha" onSubmit={guardar} noValidate>
      {error && <p className="error">{error}</p>}
      <CampoTexto
        etiqueta="Tiene Colpass desde"
        type="date"
        max={hoyBogota()}
        valor={desde}
        alCambiar={setDesde}
        error={campos.desde}
        ayuda="Antes de esta fecha los peajes se pagaban en efectivo: no quedan por liquidar."
      />
      <div className="acciones">
        <button type="button" className="boton-enlace" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
        <button type="submit" className="boton-principal" disabled={enviando || !desde}>
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
      <h3 id="titulo-liquidaciones">Liquidaciones</h3>
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
    <>
      {error && <p className="error">{error}</p>}
      <button type="button" className="boton-enlace" disabled={enviando} onClick={quitar}>
        Quitar el Colpass
      </button>
    </>
  );
}
