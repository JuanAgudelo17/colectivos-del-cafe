import { useState } from 'react';
import { CampoSeleccion } from '../../compartido/ui/Campos.jsx';
import { pesos } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { DesgloseCostos } from './DesgloseCostos.jsx';
import { GraficaMeses } from './GraficaMeses.jsx';
import { mesLargo, porcentaje, promedio } from './utilidades.js';
import './rentabilidad.css';

// Cuánto deja cada buseta: utilidad del año mes a mes, en qué se va la plata y
// cómo se comparan las busetas. Todo sale del producido con la fórmula oficial.
export function PaginaRentabilidad() {
  const [anio, setAnio] = useState(null); // null = el año actual (lo decide el servidor)
  const [busetaId, setBusetaId] = useState(null); // null = toda la flota
  const { datos, error, cargando } = useDatos(anio ? `/rentabilidad?anio=${anio}` : '/rentabilidad');
  const vigente = datos && (anio === null || datos.anio === anio) ? datos : null;

  const elegida = vigente?.busetas.find((b) => b.id === busetaId) ?? null;
  const vista = elegida ?? vigente?.flota;
  const enCurso = vista?.meses.find((m) => m.enCurso);

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Rentabilidad</h1>
          <p className="subtitulo">Cuánto deja cada buseta después de todos los descuentos.</p>
        </div>
      </div>

      <div className="rentabilidad-filtros">
        {datos && (
          <CampoSeleccion
            etiqueta="Año"
            valor={anio ?? datos.anio}
            alCambiar={setAnio}
            opciones={datos.anios.map((a) => ({ valor: a, texto: String(a) }))}
          />
        )}
        {datos && (
          <CampoSeleccion
            etiqueta="Buseta"
            valor={busetaId}
            alCambiar={setBusetaId}
            vacio="Toda la flota"
            opciones={datos.busetas.map((b) => ({
              valor: b.id,
              texto: `${b.numeroInterno} · ${b.placa}${b.activo ? '' : ' (desactivada)'}`,
            }))}
          />
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {cargando && !vigente && <p className="vacio">Cargando…</p>}

      {vista && vista.meses.length === 0 && (
        <p className="vacio">
          {elegida ? `La ${elegida.numeroInterno} no tiene` : 'No hay'} producido registrado en {vigente.anio}.
        </p>
      )}

      {vista && vista.meses.length > 0 && (
        <>
          {elegida && (
            <p className="rentabilidad-buseta">
              <strong>
                {elegida.numeroInterno} · {elegida.placa}
              </strong>{' '}
              {elegida.conductor ?? 'Sin conductor'} · {elegida.tieneCupo ? 'Con cupo' : 'Paga arriendo'}
            </p>
          )}

          <Indicadores total={vista.total} meses={vista.meses.length} flota={!elegida} />

          {enCurso && (
            <p className="aviso rentabilidad-aviso">
              <strong>{mesLargo(enCurso.mes)} va en curso.</strong> El
              sueldo del conductor y los demás fijos ya se descuentan completos, así que la utilidad de este mes
              sube a medida que se registran los días.
            </p>
          )}

          <div className="rentabilidad-columnas">
            <section aria-labelledby="titulo-meses">
              <h2 id="titulo-meses">Utilidad mes a mes</h2>
              <GraficaMeses meses={vista.meses} ultimoMes={vigente.ultimoMes} />
              <TablaMeses meses={vista.meses} total={vista.total} />
            </section>

            <section aria-labelledby="titulo-desglose">
              <h2 id="titulo-desglose">En qué se va la plata</h2>
              <p className="rentabilidad-ayuda">Parte de lo producido en {vigente.anio}.</p>
              <DesgloseCostos total={vista.total} />
            </section>
          </div>
        </>
      )}

      {vigente && !elegida && vigente.flota.meses.length > 0 && (
        <section aria-labelledby="titulo-comparar" className="rentabilidad-comparar">
          <h2 id="titulo-comparar">Comparar busetas</h2>
          <TablaBusetas busetas={vigente.busetas} alElegir={setBusetaId} />
        </section>
      )}
    </>
  );
}

function Indicadores({ total, meses, flota }) {
  return (
    <section className="rentabilidad-indicadores" aria-label="Totales del año">
      <div className="rentabilidad-indicador rentabilidad-principal">
        <span>{total.neto < 0 ? 'Pérdida' : 'Utilidad'} {flota ? 'de la flota' : 'de la buseta'}</span>
        <strong>{pesos(total.neto)}</strong>
        <small>
          {meses} {meses === 1 ? 'mes con registro' : 'meses con registro'}
        </small>
      </div>
      <Dato texto="Producido" valor={pesos(total.bruto)} />
      <Dato texto="Costos y descuentos" valor={pesos(total.costos)} />
      <Dato
        texto="Margen"
        valor={porcentaje(total.neto, total.bruto)}
        nota={total.bruto > 0 && `Quedan $ ${Math.round((total.neto / total.bruto) * 100)} de cada $ 100`}
      />
      <Dato texto="Promedio por mes" valor={pesos(promedio(total.neto, meses))} />
      <Dato
        texto="Por día trabajado"
        valor={pesos(promedio(total.neto, total.diasTrabajados))}
        nota={`${total.diasTrabajados} ${total.diasTrabajados === 1 ? 'día' : 'días'}`}
      />
    </section>
  );
}

function Dato({ texto, valor, nota }) {
  return (
    <div className="rentabilidad-indicador">
      <span>{texto}</span>
      <strong>{valor}</strong>
      {nota && <small>{nota}</small>}
    </div>
  );
}

function TablaMeses({ meses, total }) {
  const fila = (m, titulo) => (
    <>
      <td className="numero" data-etiqueta="Producido">
        {pesos(m.bruto)}
      </td>
      <td className="numero" data-etiqueta="Costos">
        {pesos(m.costos)}
      </td>
      <td className="numero" data-etiqueta={titulo}>
        <strong>{pesos(m.neto)}</strong>
      </td>
      <td className="numero" data-etiqueta="Margen">
        {porcentaje(m.neto, m.bruto)}
      </td>
      <td className="numero" data-etiqueta="Días">
        {m.diasTrabajados}
      </td>
    </>
  );

  return (
    <div className="tabla-contenedor">
      <table className="tabla rentabilidad-tabla">
        <thead>
          <tr>
            <th>Mes</th>
            <th className="numero">Producido</th>
            <th className="numero">Costos</th>
            <th className="numero">Utilidad</th>
            <th className="numero">Margen</th>
            <th className="numero">Días</th>
          </tr>
        </thead>
        <tbody>
          {meses.map((m) => (
            <tr key={m.mes}>
              <td className="rentabilidad-mes">
                {mesLargo(m.mes)}
                {m.enCurso && <span className="etiqueta">En curso</span>}
              </td>
              {fila(m, 'Utilidad')}
            </tr>
          ))}
          {meses.length > 1 && (
            <tr className="rentabilidad-total">
              <td>Total</td>
              {fila(total, 'Utilidad')}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Ranking de las busetas por utilidad del año. Tocar una la abre en detalle.
function TablaBusetas({ busetas, alElegir }) {
  const ordenadas = [...busetas].sort(
    (a, b) => (b.meses.length > 0) - (a.meses.length > 0) || b.total.neto - a.total.neto,
  );

  return (
    <div className="tabla-contenedor">
      <table className="tabla rentabilidad-tabla">
        <thead>
          <tr>
            <th>Buseta</th>
            <th className="numero">Meses</th>
            <th className="numero">Producido</th>
            <th className="numero">Utilidad</th>
            <th className="numero">Margen</th>
            <th className="numero">Promedio mes</th>
            <th className="numero">Por día</th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((b) => (
            <tr key={b.id}>
              <td>
                <button type="button" className="boton-enlace rentabilidad-elegir" onClick={() => alElegir(b.id)}>
                  <strong>{b.numeroInterno}</strong> · {b.placa}
                </button>
                <small className="rentabilidad-conductor">
                  {b.conductor ?? 'Sin conductor'}
                  {b.tieneCupo ? '' : ' · paga arriendo'}
                </small>
              </td>
              {b.meses.length === 0 ? (
                <td colSpan={6} className="rentabilidad-sin-datos">
                  Sin producido este año
                </td>
              ) : (
                <>
                  <td className="numero" data-etiqueta="Meses">
                    {b.meses.length}
                  </td>
                  <td className="numero" data-etiqueta="Producido">
                    {pesos(b.total.bruto)}
                  </td>
                  <td className="numero" data-etiqueta="Utilidad">
                    <strong>{pesos(b.total.neto)}</strong>
                  </td>
                  <td className="numero" data-etiqueta="Margen">
                    {porcentaje(b.total.neto, b.total.bruto)}
                  </td>
                  <td className="numero" data-etiqueta="Promedio mes">
                    {pesos(promedio(b.total.neto, b.meses.length))}
                  </td>
                  <td className="numero" data-etiqueta="Por día">
                    {pesos(promedio(b.total.neto, b.total.diasTrabajados))}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
