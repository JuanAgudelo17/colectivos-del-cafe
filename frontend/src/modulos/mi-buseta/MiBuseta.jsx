import { useSesion } from '../../compartido/sesion/contexto.js';

// Vista del conductor: su buseta y el estado de sus documentos. Llega en la Fase 1.5.
export function MiBuseta() {
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
