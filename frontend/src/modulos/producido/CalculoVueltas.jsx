import { useState } from 'react';
import { numero } from '../../compartido/utilidades/formato.js';
import { calcularVueltas } from './vueltas.js';

export function CalculoVueltas({ rutas, alAplicar }) {
  const [vueltas, setVueltas] = useState({});
  const { peajes, salidas } = calcularVueltas(rutas, vueltas);
  const activas = rutas.filter((r) => r.activo);

  return (
    <form
      className="formulario"
      onSubmit={(e) => {
        e.preventDefault();
        alAplicar(peajes, salidas);
      }}
    >
      {activas.map((r) => (
        <label key={r.id} className="vuelta-ruta">
          <span>
            {r.nombre}
            <small className="ayuda">
              Vuelta: peajes {numero(2 * r.peajeTrayecto)} · salidas {numero(r.salidaIda + r.salidaRegreso)}
            </small>
          </span>
          <input
            type="number"
            min="0"
            max="20"
            inputMode="numeric"
            value={vueltas[r.id] ?? ''}
            onChange={(e) => setVueltas((v) => ({ ...v, [r.id]: e.target.value }))}
            placeholder="0"
          />
        </label>
      ))}

      <dl className="vuelta-total">
        <dt>Peajes</dt>
        <dd>$ {numero(peajes)}</dd>
        <dt>Salidas</dt>
        <dd>$ {numero(salidas)}</dd>
      </dl>
      <p className="ayuda">Reemplaza los peajes y salidas del día. Si fue distinto, corrígelos en la tabla.</p>

      <button type="submit" className="boton-principal" disabled={peajes === 0 && salidas === 0}>
        Aplicar al día
      </button>
    </form>
  );
}
