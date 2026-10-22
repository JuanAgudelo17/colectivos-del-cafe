import { useSesion } from '../sesion/contexto.js';

// Vista del conductor. Su buseta y documentos llegan en la Fase 1.5.
export function InicioConductor() {
  const { usuario } = useSesion();

  return (
    <>
      <h1>Mi buseta</h1>
      <p className="subtitulo">Hola, {usuario.nombre}.</p>
      <section className="tarjeta">
        <p>Aquí vas a ver tu buseta y el estado de sus documentos.</p>
      </section>
    </>
  );
}
