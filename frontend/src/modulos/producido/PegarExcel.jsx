import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { diasDelMes, hoyBogota, nombreMes, numero } from '../../compartido/utilidades/formato.js';
import { COLUMNAS, leerPlanilla } from './planilla.js';

// Pegar un mes completo copiado de la planilla de Excel.
export function PegarExcel({ mes, alActualizar, alTerminar }) {
  const [texto, setTexto] = useState('');
  const [progreso, setProgreso] = useState(null); // { hechos, total, error? }

  const leidos = leerPlanilla(texto);
  const validos = new Set(diasDelMes(mes.anio, mes.mes).filter((d) => d.fecha <= hoyBogota()).map((d) => d.dia));
  const dias = Object.keys(leidos)
    .map(Number)
    .sort((a, b) => a - b);
  const importables = dias.filter((d) => validos.has(d));
  const fuera = dias.filter((d) => !validos.has(d));
  const existentes = new Map(mes.dias.map((d) => [Number(d.fecha.slice(8)), d]));
  const reemplaza = importables.filter((d) => existentes.has(d)).length;
  const total = (campo) => importables.reduce((t, d) => t + (leidos[d][campo] ?? 0), 0);

  async function importar() {
    let ultimo = null;
    setProgreso({ hechos: 0, total: importables.length });
    for (const [i, dia] of importables.entries()) {
      const actual = existentes.get(dia);
      const fecha = `${mes.anio}-${String(mes.mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      try {
        ultimo = await api(`/producido/${mes.buseta.id}/${fecha}`, {
          method: 'PUT',
          cuerpo: {
            ingreso: leidos[dia].ingreso ?? 0,
            peajes: leidos[dia].peajes ?? 0,
            salidas: leidos[dia].salidas ?? 0,
            acpm: leidos[dia].acpm ?? 0,
            mantenimiento: leidos[dia].mantenimiento ?? actual?.mantenimiento ?? 0,
            relevo: actual?.relevo ?? false,
            observacion: actual?.observacion ?? null,
          },
        });
        setProgreso({ hechos: i + 1, total: importables.length });
      } catch (err) {
        setProgreso({ hechos: i, total: importables.length, error: `Día ${dia}: ${err.message}` });
        if (ultimo) alActualizar(ultimo);
        return;
      }
    }
    if (ultimo) alActualizar(ultimo);
    alTerminar();
  }

  return (
    <div className="formulario">
      <p className="ayuda">
        En Excel selecciona la tabla del mes (con la fila de los días y las filas producido, peajes, salidas y acpm),
        cópiala con Ctrl+C y pégala aquí con Ctrl+V. Se importa en <strong>{nombreMes(mes.anio, mes.mes)}</strong>.
      </p>
      <textarea
        className="pegar-area"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={'dia\t1\t2\t3 …\nproducido\t630000\t513500 …\npeajes\t89400\t84800 …'}
        disabled={progreso && !progreso.error}
        aria-label="Datos copiados de Excel"
      />

      {texto && importables.length === 0 && (
        <p className="error">No encontré días con datos. Revisa que copiaste también la fila de los días.</p>
      )}

      {importables.length > 0 && (
        <div className="pegar-vista">
          <p>
            <strong>{importables.length} días</strong> listos para importar
            {reemplaza > 0 && ` (${reemplaza} ya tenían datos y se reemplazan)`}.
          </p>
          <dl>
            {COLUMNAS.map(([campo, titulo]) => (
              <div key={campo}>
                <dt>{titulo}</dt>
                <dd>{numero(total(campo))}</dd>
              </div>
            ))}
          </dl>
          {fuera.length > 0 && (
            <p className="ayuda">Se ignoran los días {fuera.join(', ')} (no existen en el mes o todavía no han pasado).</p>
          )}
        </div>
      )}

      {progreso?.error && <p className="error">{progreso.error}</p>}

      <button
        type="button"
        className="boton-principal"
        disabled={importables.length === 0 || (progreso && !progreso.error)}
        onClick={importar}
      >
        {progreso && !progreso.error
          ? `Importando… ${progreso.hechos} de ${progreso.total}`
          : `Importar ${importables.length || ''} días`}
      </button>
    </div>
  );
}
