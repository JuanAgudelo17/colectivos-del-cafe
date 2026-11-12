// Tarjeta de indicador del dashboard: etiqueta, valor grande y una nota opcional.
// `estado` (critico | advertencia | bien) agrega una etiqueta con icono y texto;
// nunca solo color.
import { IconoEstado } from './Iconos.jsx';

const ESTADOS = {
  critico: { texto: 'Requiere atención', clase: 'documento-vencido' },
  advertencia: { texto: 'Revisar pronto', clase: 'documento-por_vencer' },
  bien: { texto: 'Al día', clase: '' },
};

export function Indicador({ etiqueta, valor, nota, estado }) {
  const e = estado && ESTADOS[estado];
  return (
    <div className="indicador">
      <span className="indicador-etiqueta">{etiqueta}</span>
      <strong className="indicador-valor">{valor ?? '…'}</strong>
      {e && (
        <span className={`documento ${e.clase}`}>
          <IconoEstado estado={estado} /> {e.texto}
        </span>
      )}
      {nota && <span className="indicador-nota">{nota}</span>}
    </div>
  );
}
