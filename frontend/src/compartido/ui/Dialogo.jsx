import { useEffect, useRef } from 'react';

// Ventana modal nativa (<dialog>): se cierra con Esc o con la X.
export function Dialogo({ abierto, titulo, alCerrar, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog ref={ref} className="dialogo" onClose={alCerrar}>
      <header className="dialogo-encabezado">
        <h2>{titulo}</h2>
        <button type="button" className="boton-icono" onClick={alCerrar} aria-label="Cerrar">
          ×
        </button>
      </header>
      {abierto && <div className="dialogo-cuerpo">{children}</div>}
    </dialog>
  );
}
