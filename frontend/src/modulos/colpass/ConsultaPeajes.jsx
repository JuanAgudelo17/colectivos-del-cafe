import { CampoTexto } from '../../compartido/ui/Campos.jsx';
import { fecha, hoyBogota, numero, pesos } from '../../compartido/utilidades/formato.js';

// Peajes de una fecha a otra (salen de la columna Peajes del producido):
// total del rango, cuánto ya se liquidó y cuánto falta, y el día a día.
// La usan el admin y el conductor. `rango` / `alCambiarRango`: { desde, hasta }.
// `nivel`: etiqueta del título (h3 cuando va dentro del apartado de Producido).
export function ConsultaPeajes({ detalle, rango, alCambiarRango, campos = {}, nivel: Titulo = 'h2' }) {
  const { consulta } = detalle;
  const hoy = hoyBogota();

  return (
    <section className="colpass-consulta" aria-labelledby="titulo-consulta">
      <Titulo id="titulo-consulta">Peajes de una fecha a otra</Titulo>
      <div className="colpass-rango">
        <CampoTexto
          etiqueta="Desde"
          type="date"
          max={rango.hasta || hoy}
          valor={rango.desde}
          alCambiar={(desde) => desde && alCambiarRango({ ...rango, desde })}
          error={campos.desde}
        />
        <CampoTexto
          etiqueta="Hasta"
          type="date"
          min={rango.desde}
          max={hoy}
          valor={rango.hasta}
          alCambiar={(hasta) => hasta && alCambiarRango({ ...rango, hasta })}
          error={campos.hasta}
        />
      </div>

      <dl className="colpass-totales">
        <div>
          <dt>Peajes del {fecha(consulta.desde)} al {fecha(consulta.hasta)}</dt>
          <dd>{pesos(consulta.total)}</dd>
        </div>
        <div>
          <dt>Ya liquidado</dt>
          <dd>{pesos(consulta.liquidado)}</dd>
        </div>
        <div className="colpass-totales-destacado">
          <dt>Por liquidar</dt>
          <dd>{pesos(consulta.porLiquidar)}</dd>
        </div>
      </dl>

      {consulta.dias.length === 0 ? (
        <p className="vacio">No hay peajes registrados en esas fechas.</p>
      ) : (
        <div className="tabla-contenedor">
          <table className="tabla colpass-tabla">
            <thead>
              <tr>
                <th>Día</th>
                <th className="numero">Peajes</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {consulta.dias.map((d) => (
                <tr key={d.fecha}>
                  <td>{fecha(d.fecha)}</td>
                  <td className="numero" data-etiqueta="Peajes">
                    {numero(d.peajes)}
                  </td>
                  <td>
                    <EstadoDia dia={d} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// Estado de un día: liquidado, parcial (cuánto se cubrió), pendiente o antes del Colpass.
function EstadoDia({ dia }) {
  if (dia.estado === 'liquidado') {
    return (
      <span className="etiqueta">
        <span aria-hidden="true">✓</span> Liquidado
      </span>
    );
  }
  if (dia.estado === 'antes') return <span className="etiqueta">Antes del Colpass</span>;
  if (dia.estado === 'parcial') {
    return <span className="etiqueta etiqueta-oscura">Faltan {pesos(dia.peajes - dia.cubierto)}</span>;
  }
  return <span className="etiqueta etiqueta-oscura">Por liquidar</span>;
}

// Lo que el conductor tiene guardado sin entregar (barra negra, la cifra principal).
export function TotalPendiente({ detalle, texto }) {
  const { pendiente, saldoAFavor } = detalle;
  return (
    <div className="colpass-pendiente">
      <span>{texto}</span>
      <strong>{pesos(pendiente.total)}</strong>
      <small>
        {pendiente.dias === 0
          ? 'No hay peajes pendientes por liquidar'
          : `Peajes pendientes por liquidar del ${fecha(pendiente.desde)} al ${fecha(pendiente.hasta)} · ${
              pendiente.dias
            } ${pendiente.dias === 1 ? 'día' : 'días'}`}
      </small>
      {saldoAFavor > 0 && <small>Saldo a favor del conductor: {pesos(saldoAFavor)}</small>}
    </div>
  );
}
