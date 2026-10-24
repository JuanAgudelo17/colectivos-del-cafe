import { useEffect, useRef, useState } from 'react';
import { api } from '../../compartido/api.js';
import { CampoTexto } from '../../compartido/ui/Campos.jsx';
import { Dialogo } from '../../compartido/ui/Dialogo.jsx';
import { fecha, hoyBogota, pesos } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';
import { ConsultaPeajes, TotalPendiente } from './ConsultaPeajes.jsx';
import { FormularioEntrega, ListaEntregas } from './Entregas.jsx';
import './colpass.css';

const inicioDelMes = () => `${hoyBogota().slice(0, 8)}01`;

// Apartado "Peajes Colpass" dentro de Producido (admin), para la buseta elegida.
// Con Colpass: lo que el conductor tiene guardado para el propietario, consulta
// por fechas y las entregas (las registra el conductor o el admin). Sin Colpass:
// solo un enlace para activarlo.
// `cambio`: cuando cambia (ej. los peajes del mes en la cuadrícula), se recarga.
export function SeccionColpass({ busetaId, cambio }) {
  const [rango, setRango] = useState(() => ({ desde: inicioDelMes(), hasta: hoyBogota() }));
  const [registrando, setRegistrando] = useState(false);
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

  return (
    <section className="colpass-seccion" aria-labelledby="titulo-colpass">
      <h2 id="titulo-colpass">Peajes Colpass</h2>
      <p className="subtitulo">
        La empresa le da los peajes al conductor, pero el Colpass los cobra aparte: él guarda esa plata hasta
        entregársela al propietario. Cada entrega cubre los peajes pendientes más viejos.
      </p>

      <div className="colpass-encabezado">
        <TotalPendiente
          detalle={datos}
          texto={`Por entregar al propietario · ${datos.buseta.conductor ?? 'sin conductor'}`}
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
        <ConsultaPeajes detalle={datos} rango={rango} alCambiarRango={setRango} nivel="h3" />

        <section aria-labelledby="titulo-entregas">
          <h3 id="titulo-entregas">Entregas al propietario</h3>
          {datos.pendiente.total > 0 && (
            <button type="button" className="boton-principal colpass-registrar" onClick={() => setRegistrando(true)}>
              Registrar entrega
            </button>
          )}
          <ListaEntregas
            entregas={datos.entregas}
            rutaBorrar={(id) => `/colpass/${busetaId}/entregas/${id}`}
            alActualizar={recargar}
          />
          <p className="colpass-nota">Total entregado: {pesos(datos.totalEntregado)}</p>
        </section>
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

      <Dialogo abierto={registrando} titulo="Registrar entrega al propietario" alCerrar={() => setRegistrando(false)}>
        <FormularioEntrega
          ruta={`/colpass/${busetaId}/entregas`}
          detalle={datos}
          alGuardar={() => {
            setRegistrando(false);
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
        ayuda="Antes de esta fecha los peajes se pagaban en efectivo: no se le entregan al propietario."
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

function QuitarColpass({ buseta, alQuitar }) {
  const { enviando, error, enviar } = useEnvio();

  async function quitar() {
    if (!window.confirm(`¿Quitar el Colpass de la ${buseta.numeroInterno}? Las entregas hechas se conservan.`)) {
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
