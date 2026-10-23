import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { diasDelMes, hoyBogota, numero } from '../../compartido/utilidades/formato.js';
import { COLUMNAS } from './planilla.js';

// Mueve el foco a la misma columna de otra fila (Enter / flechas, como en Excel).
function moverFoco(fila, col) {
  document.querySelector(`[data-celda="${fila}-${col}"]`)?.focus();
}

// Celda de pesos: muestra "630.000" y al editar solo los dígitos.
function CeldaPesos({ valor, alCambiar, fila, col, deshabilitada, etiqueta }) {
  const [foco, setFoco] = useState(false);
  return (
    <input
      className="celda"
      inputMode="numeric"
      autoComplete="off"
      aria-label={etiqueta}
      data-celda={`${fila}-${col}`}
      disabled={deshabilitada}
      value={foco ? valor : numero(valor)}
      onFocus={(e) => {
        setFoco(true);
        requestAnimationFrame(() => e.target.select());
      }}
      onBlur={() => setFoco(false)}
      onChange={(e) => alCambiar(e.target.value.replace(/\D/g, ''))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
          e.preventDefault();
          moverFoco(fila + 1, col);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          moverFoco(fila - 1, col);
        }
      }}
    />
  );
}

// Un día: los valores guardados vienen del servidor; lo que se está editando
// vive en `cambios` hasta que la fila se guarda (al salir de ella).
function FilaDia({ info, indice, registro, busetaId, bloqueada, alActualizar, abrirVueltas }) {
  const [cambios, setCambios] = useState({});
  const [estado, setEstado] = useState({ tipo: 'listo' });

  const guardados = Object.fromEntries(
    COLUMNAS.map(([campo]) => [campo, registro && registro[campo] !== 0 ? String(registro[campo]) : '']),
  );
  const valores = { ...guardados, ...cambios };
  const relevo = cambios.relevo ?? registro?.relevo ?? false;
  const futuro = info.fecha > hoyBogota();
  const deshabilitada = bloqueada || futuro;

  async function guardar(extra = {}) {
    const todo = { ...valores, relevo, ...extra };
    setEstado({ tipo: 'guardando' });
    try {
      const mes = await api(`/producido/${busetaId}/${info.fecha}`, {
        method: 'PUT',
        cuerpo: {
          ingreso: todo.ingreso,
          peajes: todo.peajes,
          salidas: todo.salidas,
          acpm: todo.acpm,
          mantenimiento: registro?.mantenimiento ?? 0,
          observacion: registro?.observacion ?? null,
          relevo: todo.relevo,
        },
      });
      setCambios({});
      setEstado({ tipo: 'listo' });
      alActualizar(mes);
    } catch (err) {
      setEstado({ tipo: 'error', mensaje: err.message });
    }
  }

  const hayCambios = Object.keys(cambios).length > 0;

  return (
    <tr
      className={[futuro && 'fila-futura', relevo && 'fila-relevo', estado.tipo === 'error' && 'fila-error']
        .filter(Boolean)
        .join(' ')}
      onBlur={(e) => {
        if (hayCambios && !e.currentTarget.contains(e.relatedTarget)) guardar();
      }}
    >
      <th scope="row" className="col-dia">
        <span className="dia-numero">{info.dia}</span>
        <span className="dia-semana">{info.semana}</span>
      </th>
      {COLUMNAS.map(([campo, titulo], col) => (
        <td key={campo}>
          <CeldaPesos
            valor={valores[campo]}
            alCambiar={(v) => setCambios((c) => ({ ...c, [campo]: v }))}
            fila={indice}
            col={col}
            deshabilitada={deshabilitada}
            etiqueta={`${titulo} del día ${info.dia}`}
          />
        </td>
      ))}
      <td className="col-relevo">
        <label className="relevo" title="El conductor descansa y trabaja el reemplazo">
          <input
            type="checkbox"
            checked={relevo}
            disabled={deshabilitada}
            onChange={(e) => {
              // Se marca de una vez; si el guardado falla, la fila queda en error.
              const marcado = e.target.checked;
              setCambios((c) => ({ ...c, relevo: marcado }));
              guardar({ relevo: marcado });
            }}
          />
          <span className="sr">Relevo el día {info.dia}</span>
        </label>
      </td>
      <td className="col-acciones">
        <button
          type="button"
          className="boton-enlace"
          disabled={deshabilitada}
          onClick={() =>
            abrirVueltas(info, (peajes, salidas) => {
              setCambios((c) => ({ ...c, peajes: String(peajes), salidas: String(salidas) }));
              guardar({ peajes: String(peajes), salidas: String(salidas) });
            })
          }
        >
          Vueltas
        </button>
        <span className={`estado-fila estado-${estado.tipo}`} title={estado.mensaje}>
          {estado.tipo === 'guardando' && 'Guardando…'}
          {estado.tipo === 'error' && '⚠ No se guardó'}
          {estado.tipo === 'listo' && hayCambios && 'Sin guardar'}
        </span>
      </td>
    </tr>
  );
}

// Cuadrícula del mes: un día por fila, como la planilla, con totales abajo.
export function CuadriculaMes({ mes, alActualizar, abrirVueltas }) {
  const porFecha = Object.fromEntries(mes.dias.map((d) => [d.fecha, d]));
  const { resumen } = mes;

  return (
    <div className="cuadricula-contenedor">
      <table className="cuadricula">
        <thead>
          <tr>
            <th scope="col" className="col-dia">
              Día
            </th>
            {COLUMNAS.map(([campo, titulo]) => (
              <th key={campo} scope="col">
                {titulo}
              </th>
            ))}
            <th scope="col" className="col-relevo">
              Relevo
            </th>
            <th scope="col" className="col-acciones">
              <span className="sr">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {diasDelMes(mes.anio, mes.mes).map((info, i) => (
            <FilaDia
              key={info.fecha}
              info={info}
              indice={i}
              registro={porFecha[info.fecha]}
              busetaId={mes.buseta.id}
              bloqueada={mes.cerrado}
              alActualizar={alActualizar}
              abrirVueltas={abrirVueltas}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{numero(resumen.bruto)}</td>
            <td>{numero(resumen.peajes)}</td>
            <td>{numero(resumen.salidas)}</td>
            <td>{numero(resumen.acpm)}</td>
            <td className="col-relevo">{resumen.diasRelevo || ''}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
