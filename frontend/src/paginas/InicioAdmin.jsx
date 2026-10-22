import { useSesion } from '../sesion/contexto.js';

// Panel del administrador. El CRUD de empresas, busetas y conductores llega en la Fase 1.4.
export function InicioAdmin() {
  const { usuario } = useSesion();

  return (
    <>
      <h1>Panel de administración</h1>
      <p className="subtitulo">Hola, {usuario.nombre}.</p>
      <section className="tarjeta">
        <p>Aquí vas a gestionar empresas, busetas, conductores y documentos.</p>
      </section>
    </>
  );
}
