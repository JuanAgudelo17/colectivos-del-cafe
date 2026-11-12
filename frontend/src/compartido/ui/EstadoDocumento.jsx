import { textoDocumento } from '../utilidades/formato.js';
import { IconoEstado } from './Iconos.jsx';

// Alerta visual del SOAT o la tecnomecánica: rojo vencido, ámbar ≤ 30 días.
// Siempre lleva icono y texto, nunca solo color.
export function EstadoDocumento({ nombre, documento, compacto = false }) {
  return (
    <span className={`documento documento-${documento.estado}`} title={compacto ? textoDocumento(documento) : undefined}>
      <IconoEstado estado={documento.estado} />
      {nombre && <strong>{nombre}:</strong>} {compacto ? textoCorto(documento) : textoDocumento(documento)}
    </span>
  );
}

function textoCorto({ estado, dias }) {
  if (estado === 'sin_fecha') return 'Sin fecha';
  if (estado === 'vencido') return 'Vencido';
  if (estado === 'por_vencer') return dias === 0 ? 'Hoy' : `${dias} d`;
  return 'Vigente';
}
