import { IconoEstado } from '../../compartido/ui/Iconos.jsx';
import { textoEstado } from './proximo.js';

// Mismos colores que los documentos: rojo vencido, ámbar pronto. Siempre icono + texto.
const CLASE = {
  vencido: 'documento-vencido',
  pronto: 'documento-por_vencer',
  al_dia: 'documento-vigente',
  sin_registro: 'documento-sin_fecha',
};

const CORTO = { vencido: 'Vencido', pronto: 'Pronto', al_dia: 'Al día', sin_registro: 'Sin registro' };

export function EstadoMantenimiento({ estado, nombre, compacto = false }) {
  return (
    <span className={`documento ${CLASE[estado.estado]}`} title={compacto ? textoEstado(estado) : undefined}>
      <IconoEstado estado={estado.estado} />
      {nombre && <strong>{nombre}:</strong>} {compacto ? CORTO[estado.estado] : textoEstado(estado)}
    </span>
  );
}
