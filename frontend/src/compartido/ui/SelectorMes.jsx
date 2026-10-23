import { mesActual } from '../utilidades/formato.js';

// Selector de mes (input nativo type="month"). No deja elegir meses futuros.
// valor / alCambiar: { anio, mes }
export function SelectorMes({ valor, alCambiar, etiqueta = 'Mes' }) {
  const hoy = mesActual();
  const aTexto = ({ anio, mes }) => `${anio}-${String(mes).padStart(2, '0')}`;

  return (
    <label className="selector-mes">
      <span>{etiqueta}</span>
      <input
        type="month"
        value={aTexto(valor)}
        max={aTexto(hoy)}
        onChange={(e) => {
          if (!e.target.value) return;
          const [anio, mes] = e.target.value.split('-').map(Number);
          alCambiar({ anio, mes });
        }}
      />
    </label>
  );
}
