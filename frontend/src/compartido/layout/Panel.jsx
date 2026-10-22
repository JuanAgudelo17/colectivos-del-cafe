import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useSesion } from '../sesion/contexto.js';
import './panel.css';

// Estructura tipo dashboard: barra lateral con los módulos del rol y el contenido
// a la derecha. En celular la barra se vuelve un menú que se abre con ☰.
export function Panel({ modulos, base }) {
  const { usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  async function salir() {
    await cerrarSesion();
    navegar('/login', { replace: true });
  }

  return (
    <div className={menuAbierto ? 'panel panel-menu-abierto' : 'panel'}>
      <header className="panel-barra-movil">
        <button type="button" className="boton-icono" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú">
          ☰
        </button>
        <span className="marca">Colectivos del Café</span>
      </header>

      <div className="panel-velo" onClick={() => setMenuAbierto(false)} aria-hidden="true" />

      <aside className="panel-lateral">
        <div className="panel-marca">
          <span className="marca">Colectivos del Café</span>
          <small>{usuario.rol === 'admin' ? 'Administración' : 'Conductor'}</small>
        </div>

        <nav className="panel-menu">
          {modulos.map((m) =>
            m.Pagina ? (
              <NavLink
                key={m.id}
                to={m.ruta ? `${base}/${m.ruta}` : base}
                end={!m.ruta}
                onClick={() => setMenuAbierto(false)}
              >
                <span className="panel-icono" aria-hidden="true">
                  {m.icono}
                </span>
                {m.titulo}
              </NavLink>
            ) : (
              <span key={m.id} className="panel-pendiente" title={`Llega en la Fase ${m.fase}`}>
                <span className="panel-icono" aria-hidden="true">
                  {m.icono}
                </span>
                {m.titulo}
                <small>Fase {m.fase}</small>
              </span>
            ),
          )}
        </nav>

        <div className="panel-usuario">
          <span>{usuario.nombre}</span>
          <button type="button" className="boton-secundario" onClick={salir}>
            Salir
          </button>
        </div>
      </aside>

      <main className="panel-contenido">
        <Outlet />
      </main>
    </div>
  );
}
