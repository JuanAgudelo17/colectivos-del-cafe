import { NavLink, Outlet, useNavigate } from 'react-router';
import { useSesion } from '../sesion/contexto.js';

const MENU_ADMIN = [
  { a: '/admin', texto: 'Inicio', exacto: true },
  { a: '/admin/empresas', texto: 'Empresas' },
  { a: '/admin/busetas', texto: 'Busetas' },
  { a: '/admin/conductores', texto: 'Conductores' },
];

export function Plantilla() {
  const { usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();
  const menu = usuario.rol === 'admin' ? MENU_ADMIN : [];

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
      {menu.length > 0 && (
        <nav className="menu">
          {menu.map((item) => (
            <NavLink key={item.a} to={item.a} end={item.exacto}>
              {item.texto}
            </NavLink>
          ))}
        </nav>
      )}
      <main className="contenedor">
        <Outlet />
      </main>
    </>
  );
}
