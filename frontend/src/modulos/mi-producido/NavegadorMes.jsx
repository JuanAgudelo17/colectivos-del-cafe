import { useRef } from 'react';
import { mesActual, nombreMes } from '../../compartido/utilidades/formato.js';

const aTexto = ({ anio, mes }) => `${anio}-${String(mes).padStart(2, '0')}`;

// ‹ octubre de 2026 › — cambiar de mes con el dedo. Tocar el nombre abre el
// selector del celular para saltar a cualquier mes. No deja ir a meses futuros.
export function NavegadorMes({ valor, alCambiar }) {
  const selector = useRef(null);
  const hoy = mesActual();
  const esActual = valor.anio === hoy.anio && valor.mes === hoy.mes;

  const mover = (delta) => {
    const fecha = new Date(Date.UTC(valor.anio, valor.mes - 1 + delta, 1));
    alCambiar({ anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() + 1 });
  };

  return (
    <div className="mp-navegador" role="group" aria-label="Mes">
      <button type="button" className="mp-navegador-flecha" onClick={() => mover(-1)} aria-label="Mes anterior">
        ‹
      </button>
      <button
        type="button"
        className="mp-navegador-mes"
        onClick={() => selector.current?.showPicker?.() ?? selector.current?.focus()}
      >
        {nombreMes(valor.anio, valor.mes)}
        {esActual && <small>Mes actual</small>}
      </button>
      <input
        ref={selector}
        type="month"
        className="mp-navegador-selector"
        value={aTexto(valor)}
        max={aTexto(hoy)}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          if (!e.target.value) return;
          const [anio, mes] = e.target.value.split('-').map(Number);
          alCambiar({ anio, mes });
        }}
      />
      <button
        type="button"
        className="mp-navegador-flecha"
        onClick={() => mover(1)}
        disabled={esActual}
        aria-label="Mes siguiente"
      >
        ›
      </button>
    </div>
  );
}
