import { textoEstado } from './proximo.js';

// Mismos colores que los documentos: rojo vencido, ámbar pronto. Siempre icono + texto.
const ESTILO = {
  vencido: ['⛔', 'documento-vencido'],
  pronto: ['⚠️', 'documento-por_vencer'],
  al_dia: ['✅', 'documento-vigente'],
  sin_registro: ['❔', 'documento-sin_fecha'],
};

const CORTO = { vencido: 'Vencido', pronto: 'Pronto', al_dia: 'Al día', sin_registro: 'Sin registro' };

export function EstadoMantenimiento({ estado, nombre, compacto = false }) {
  const [icono, clase] = ESTILO[estado.estado];
  return (
    <span className={`documento ${clase}`} title={compacto ? textoEstado(estado) : undefined}>
      <span aria-hidden="true">{icono}</span>
      {nombre && <strong>{nombre}:</strong>} {compacto ? CORTO[estado.estado] : textoEstado(estado)}
    </span>
  );
}
