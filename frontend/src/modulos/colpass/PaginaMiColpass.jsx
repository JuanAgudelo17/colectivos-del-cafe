import { useState } from 'react';
import { Link } from 'react-router';
import { fecha, hoyBogota, pesos } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { ConsultaPeajes, TotalPendiente } from './ConsultaPeajes.jsx';
import './colpass.css';

const inicioDelMes = () => `${hoyBogota().slice(0, 8)}01`;

// Vista del conductor de una buseta con Colpass: la plata de peajes que guarda,
// los peajes de una fecha a otra y lo que ya entregó. Solo consulta: las
// liquidaciones las registra el admin.
export function PaginaMiColpass() {
  const [rango, setRango] = useState(() => ({ desde: inicioDelMes(), hasta: hoyBogota() }));
  const { datos, error } = useDatos(`/colpass/mio?desde=${rango.desde}&hasta=${rango.hasta}`);

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <Link to="/conductor/mi-producido" className="colpass-volver">
            ← Mi producido
          </Link>
          <h1>Peajes Colpass</h1>
          <p className="subtitulo">
            La plata de los peajes que te da la empresa y guardas porque el Colpass los paga.
          </p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {!datos && !error && <p className="vacio">Cargando…</p>}
      {datos && !datos.colpass && <p className="vacio">Tu buseta no tiene Colpass.</p>}

      {datos?.colpass && (
        <>
          <TotalPendiente pendiente={datos.pendiente} texto="Por entregar al administrador" />

          <div className="colpass-cuerpo">
            <ConsultaPeajes detalle={datos} rango={rango} alCambiarRango={setRango} />

            <section aria-labelledby="titulo-entregas">
              <h2 id="titulo-entregas">Lo que ya entregaste</h2>
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
                    </li>
                  ))}
                </ul>
              )}
              <p className="colpass-nota">Colpass desde el {fecha(datos.colpass.desde)}.</p>
            </section>
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
        <small>Por entregar al administrador</small>
      </span>
      <strong className="colpass-aviso-valor">{pesos(datos.pendiente.total)}</strong>
      <span aria-hidden="true">→</span>
    </Link>
  );
}
