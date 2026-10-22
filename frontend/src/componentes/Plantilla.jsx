import { Outlet, useNavigate } from 'react-router';
import { useSesion } from '../sesion/contexto.js';

export function Plantilla() {
  const { usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();

  async function salir() {
    await cerrarSesion();
    navegar('/login', { replace: true });
  }

  return (
    <>
      <header className="encabezado">
        <span className="marca">Colectivos del Café</span>
        <div className="encabezado-usuario">
          <span>{usuario.nombre}</span>
          <button type="button" className="boton-secundario" onClick={salir}>
            Salir
          </button>
        </div>
      </header>
      <main className="contenedor">
        <Outlet />
      </main>
    </>
  );
}
