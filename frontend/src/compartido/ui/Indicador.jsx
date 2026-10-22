// Tarjeta de indicador del dashboard: etiqueta, valor grande y una nota opcional.
// `estado` (critico | advertencia | bien) agrega una etiqueta con icono y texto;
// nunca solo color.
const ESTADOS = {
  critico: { icono: '⛔', texto: 'Requiere atención', clase: 'documento-vencido' },
  advertencia: { icono: '⚠️', texto: 'Revisar pronto', clase: 'documento-por_vencer' },
  bien: { icono: '✓', texto: 'Al día', clase: '' },
};

export function Indicador({ etiqueta, valor, nota, estado }) {
  const e = estado && ESTADOS[estado];
  return (
    <div className="indicador">
      <span className="indicador-etiqueta">{etiqueta}</span>
      <strong className="indicador-valor">{valor ?? '…'}</strong>
      {e && (
        <span className={`documento ${e.clase}`}>
          <span aria-hidden="true">{e.icono}</span> {e.texto}
        </span>
      )}
      {nota && <span className="indicador-nota">{nota}</span>}
    </div>
  );
}
