// Tarjeta de indicador del dashboard: etiqueta, valor grande y una nota opcional.
// `estado` (critico | advertencia | bien) agrega icono + color; nunca color solo.
const ICONOS = { critico: '⛔', advertencia: '⚠️', bien: '✅' };

export function Indicador({ etiqueta, valor, nota, estado }) {
  return (
    <div className={`indicador${estado ? ` indicador-${estado}` : ''}`}>
      <span className="indicador-etiqueta">{etiqueta}</span>
      <strong className="indicador-valor">
        {estado && <span aria-hidden="true">{ICONOS[estado]} </span>}
        {valor ?? '…'}
      </strong>
      {nota && <span className="indicador-nota">{nota}</span>}
    </div>
  );
}
