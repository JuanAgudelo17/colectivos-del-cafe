import { useState } from 'react';
import { SelectorMes } from '../../compartido/ui/SelectorMes.jsx';
import { diasDelMes, mesActual, nombreMes, numero } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import './mi-producido.css';

// El conductor consulta lo que hizo cada día (producido, peajes, salidas, ACPM)
// y los totales del mes. El resumen financiero (20 %, fondo, neto) no lo ve.
export function PaginaMiProducido() {
  const [periodo, setPeriodo] = useState(mesActual);
  const { datos, error, cargando } = useDatos(`/producido/mio?anio=${periodo.anio}&mes=${periodo.mes}`);
  const vigente = datos && datos.anio === periodo.anio && datos.mes === periodo.mes ? datos : null;
  const semana = Object.fromEntries(diasDelMes(periodo.anio, periodo.mes).map((d) => [d.fecha, d.semana]));

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Mi producido</h1>
          <p className="subtitulo">Lo que registró el administrador para tu buseta, día por día.</p>
        </div>
      </div>

      <div className="mi-producido-filtros">
        <SelectorMes valor={periodo} alCambiar={setPeriodo} />
      </div>

      {error && <p className="error">{error}</p>}
      {cargando && !vigente && <p className="vacio">Cargando…</p>}

      {vigente && !vigente.buseta && (
        <p className="vacio">Aún no tienes buseta asignada. Cuando la tengas, aquí verás tu producido.</p>
      )}

      {vigente?.buseta && (
        <>
          <h2 className="mi-producido-mes">
            {nombreMes(vigente.anio, vigente.mes)}
            <span>
              {' '}
              · {vigente.buseta.numeroInterno} · {vigente.buseta.placa}
            </span>
          </h2>

          <section className="mi-producido-totales" aria-label="Totales del mes">
            <div className="mi-producido-total mi-producido-principal">
              <span>Producido del mes</span>
              <strong>$ {numero(vigente.totales.ingreso)}</strong>
              <small>
                {vigente.totales.diasTrabajados}{' '}
                {vigente.totales.diasTrabajados === 1 ? 'día trabajado' : 'días trabajados'}
              </small>
            </div>
            {[
              ['Peajes', vigente.totales.peajes],
              ['Salidas', vigente.totales.salidas],
              ['ACPM', vigente.totales.acpm],
              ['ACPM La Guaca', vigente.totales.acpmCredito],
            ].map(([texto, valor]) => (
              <div key={texto} className="mi-producido-total">
                <span>{texto}</span>
                <strong>$ {numero(valor)}</strong>
              </div>
            ))}
          </section>

          {vigente.dias.length === 0 ? (
            <p className="vacio">Todavía no hay días registrados en este mes.</p>
          ) : (
            <div className="tabla-contenedor">
              <table className="tabla mi-producido-tabla">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th className="numero">Producido</th>
                    <th className="numero">Peajes</th>
                    <th className="numero">Salidas</th>
                    <th className="numero">ACPM</th>
                    <th className="numero">ACPM Guaca</th>
                  </tr>
                </thead>
                <tbody>
                  {vigente.dias.map((d) => (
                    <tr key={d.fecha}>
                      <td>
                        <strong>{Number(d.fecha.slice(8))}</strong> {semana[d.fecha]}
                        {d.relevo && <span className="etiqueta">Relevo</span>}
                      </td>
                      <td className="numero" data-etiqueta="Producido">
                        {numero(d.ingreso)}
                      </td>
                      <td className="numero" data-etiqueta="Peajes">
                        {numero(d.peajes)}
                      </td>
                      <td className="numero" data-etiqueta="Salidas">
                        {numero(d.salidas)}
                      </td>
                      <td className="numero" data-etiqueta="ACPM">
                        {numero(d.acpm)}
                      </td>
                      <td className="numero" data-etiqueta="ACPM Guaca">
                        {numero(d.acpmCredito)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
