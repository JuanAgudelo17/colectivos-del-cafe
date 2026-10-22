// Tira de pestañas para filtrar una lista. La activa lleva el turquesa de la guía.
// opciones: [{ valor, texto, cantidad? }]
export function Pestanas({ opciones, valor, alCambiar, etiqueta }) {
  return (
    <div className="pestanas" role="tablist" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="tab"
          aria-selected={o.valor === valor}
          onClick={() => alCambiar(o.valor)}
        >
          {o.texto}
          {o.cantidad !== undefined && <small>{o.cantidad}</small>}
        </button>
      ))}
    </div>
  );
}
