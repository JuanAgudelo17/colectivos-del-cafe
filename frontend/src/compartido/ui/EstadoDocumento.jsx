import { textoDocumento } from '../utilidades/formato.js';

const ICONOS = { vencido: '⛔', por_vencer: '⚠️', vigente: '✅', sin_fecha: '❔' };

// Alerta visual del SOAT o la tecnomecánica: rojo vencido, ámbar ≤ 30 días.
export function EstadoDocumento({ nombre, documento }) {
  return (
    <span className={`documento documento-${documento.estado}`}>
      <span aria-hidden="true">{ICONOS[documento.estado]}</span>
      <strong>{nombre}:</strong> {textoDocumento(documento)}
    </span>
  );
}
