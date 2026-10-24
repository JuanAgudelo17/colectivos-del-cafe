import { useState } from 'react';
import { diasDelMes, pesos } from '../../compartido/utilidades/formato.js';

// El detalle se abre centrado sobre la barra, pegado al borde en los extremos.
function posicionDetalle(centro) {
  const desplazar = centro > 0.75 ? '-100%' : centro < 0.25 ? '0' : '-50%';
  return { left: `${centro * 100}%`, transform: `translateX(${desplazar})` };
}

// Producido de cada día del mes en barras. La del mejor día va en negro y la
// línea punteada es el promedio. Al tocar (o pasar el mouse por) un día se ve
// su detalle. La lista "Día por día" tiene los mismos datos.
export function GraficaDias({ anio, mes, dias, promedio }) {
  const [activo, setActivo] = useState(null);
  const columnas = diasDelMes(anio, mes);
  const delDia = new Map(dias.map((d) => [d.fecha, d]));
  const maximo = Math.max(1, ...dias.map((d) => d.ingreso));
  const mejor = dias.reduce((m, d) => (d.ingreso > (m?.ingreso ?? 0) ? d : m), null);
  const indice = columnas.findIndex((c) => c.fecha === activo);
  const detalle = activo && delDia.get(activo);
  const columna = columnas[indice];

  return (
    <div className="mp-grafica" onMouseLeave={() => setActivo(null)}>
      <div className="mp-grafica-area" style={{ '--columnas': columnas.length }}>
        {promedio > 0 && (
          <div className="mp-grafica-promedio" style={{ bottom: `${(promedio / maximo) * 100}%` }}>
            <span>Promedio {pesos(promedio)}</span>
          </div>
        )}
        {columnas.map((c) => {
          const d = delDia.get(c.fecha);
          const clases = ['mp-grafica-barra', d === mejor && 'mp-grafica-mejor', d?.relevo && 'mp-grafica-relevo']
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={c.fecha}
              type="button"
              className={activo === c.fecha ? 'mp-grafica-columna mp-grafica-activa' : 'mp-grafica-columna'}
              aria-label={`${c.semana} ${c.dia}: ${d ? pesos(d.ingreso) : 'sin registro'}`}
              onMouseEnter={() => setActivo(c.fecha)}
              onFocus={() => setActivo(c.fecha)}
              onClick={() => setActivo(c.fecha)}
            >
              {d && <span className={clases} style={{ height: `${Math.max((d.ingreso / maximo) * 100, 2)}%` }} />}
            </button>
          );
        })}

        {columna && (
          <div className="mp-grafica-detalle" style={posicionDetalle((indice + 0.5) / columnas.length)} role="status">
            <strong>
              <span className="mp-grafica-detalle-dia">
                {columna.semana} {columna.dia}
              </span>
              <EtiquetasDia dia={detalle} mejor={mejor} />
            </strong>
            {detalle ? (
              <>
                <span className="mp-grafica-detalle-valor">{pesos(detalle.ingreso)}</span>
                <small>
                  Peajes {pesos(detalle.peajes)} · ACPM {pesos(detalle.acpm + detalle.acpmCredito)}
                </small>
              </>
            ) : (
              <small>Sin registro</small>
            )}
          </div>
        )}
      </div>

      {/* Números de los días cada 5 para no amontonar */}
      <div className="mp-grafica-ejes" style={{ '--columnas': columnas.length }} aria-hidden="true">
        {columnas.map((c) => (
          <span key={c.fecha}>{c.dia === 1 || c.dia % 5 === 0 ? c.dia : ''}</span>
        ))}
      </div>
    </div>
  );
}

// Etiquetas del día en el detalle: mejor del mes y relevo.
function EtiquetasDia({ dia, mejor }) {
  if (!dia) return null;
  return (
    <>
      {dia === mejor && <span className="etiqueta etiqueta-oscura">Mejor día</span>}
      {dia.relevo && <span className="etiqueta">Relevo</span>}
    </>
  );
}
