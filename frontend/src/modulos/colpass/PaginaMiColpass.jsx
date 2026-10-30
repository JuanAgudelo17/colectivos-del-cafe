import { useState } from 'react';
import { Link } from 'react-router';
import { fecha, hoyBogota, pesos } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { ConsultaPeajes, TotalPendiente } from './ConsultaPeajes.jsx';
import { FormularioEntrega, ListaEntregas } from './Entregas.jsx';
import './colpass.css';

const inicioDelMes = () => `${hoyBogota().slice(0, 8)}01`;

// Vista del conductor de una buseta con Colpass: la plata de peajes que guarda
// para el propietario, los peajes de una fecha a otra y lo que ya entregó. Él
// mismo registra cada entrega y queda liquidada de una vez.
export function PaginaMiColpass() {
  const [rango, setRango] = useState(() => ({ desde: inicioDelMes(), hasta: hoyBogota() }));
  const [registrando, setRegistrando] = useState(false);
  const { datos, error, recargar } = useDatos(`/colpass/mio?desde=${rango.desde}&hasta=${rango.hasta}`);
  const hayPendiente = datos?.pendiente?.total > 0;

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <Link to="/conductor/mi-producido" className="colpass-volver">
            ← Mi producido
          </Link>
          <h1>Peajes Colpass</h1>
          <p className="subtitulo">
            La plata de los peajes que te da la empresa y guardas para el propietario, porque el Colpass los paga.
          </p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {!datos && !error && <p className="vacio">Cargando…</p>}
      {datos && !datos.colpass && <p className="vacio">Tu buseta no tiene Colpass.</p>}

      {datos?.colpass && (
        <>
          <TotalPendiente detalle={datos} texto="Por entregar al propietario" />

          {/* En celular primero lo que ya entregó (y el botón para registrar), luego la consulta */}
          <div className="colpass-cuerpo colpass-cuerpo-conductor">
            <section aria-labelledby="titulo-entregas">
              <h2 id="titulo-entregas">Lo que ya entregaste</h2>
              {registrando ? (
                <FormularioEntrega
                  ruta={`/colpass/mio/entregas?desde=${rango.desde}&hasta=${rango.hasta}`}
                  detalle={datos}
                  alGuardar={() => {
                    setRegistrando(false);
                    recargar();
                  }}
                  alCancelar={() => setRegistrando(false)}
                />
              ) : (
                hayPendiente && (
                  <button
                    type="button"
                    className="boton-principal colpass-registrar"
                    onClick={() => setRegistrando(true)}
                  >
                    Registrar lo que entregué
                  </button>
                )
              )}
              <ListaEntregas
                entregas={datos.entregas}
                rutaBorrar={(id) => `/colpass/mio/entregas/${id}`}
                alActualizar={recargar}
                quien="conductor"
              />
              <p className="colpass-nota">
                Total entregado: {pesos(datos.totalEntregado)} · Colpass desde el {fecha(datos.colpass.desde)}. Puedes
                quitar lo que registraste durante 7 días si te equivocaste.
              </p>
            </section>

            <ConsultaPeajes detalle={datos} rango={rango} alCambiarRango={setRango} />
          </div>
        </>
      )}
    </>
  );
}

// Tarjeta para "Mi producido": solo aparece si la buseta del conductor tiene Colpass.
export function AvisoColpass() {
  const { datos } = useDatos('/colpass/mio');
  if (!datos?.colpass) return null;

  return (
    <Link to="/conductor/mi-producido/peajes" className="colpass-aviso">
      <span>
        <strong>Peajes Colpass</strong>
        <small>Por entregar al propietario</small>
      </span>
      <strong className="colpass-aviso-valor">{pesos(datos.pendiente.total)}</strong>
      <span aria-hidden="true">→</span>
    </Link>
  );
}
