import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useSesion } from '../sesion/contexto.js';
import './panel.css';

// Estructura de las pantallas con sesión: barra negra arriba con los módulos
// del rol, contenido blanco al centro y pie negro. En celular el menú se abre
// con ☰ como una cortina negra.
export function Panel({ modulos, base }) {
  const { usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrarMenu = () => setMenuAbierto(false);

  async function salir() {
    await cerrarSesion();
    navegar('/login', { replace: true });
  }

  const enlaces = modulos.map((m) =>
    m.Pagina ? (
      <NavLink key={m.id} to={m.ruta ? `${base}/${m.ruta}` : base} end={!m.ruta} onClick={cerrarMenu}>
        {m.titulo}
      </NavLink>
    ) : (
      <span key={m.id} className="barra-pendiente" title={`Llega en la Fase ${m.fase}`}>
        {m.titulo}
        <small>Fase {m.fase}</small>
      </span>
    ),
  );

  return (
    <div className={menuAbierto ? 'panel panel-menu-abierto' : 'panel'}>
      <header className="barra">
        <div className="barra-interior">
          <Link to={base} className="marca barra-marca" onClick={cerrarMenu}>
            Colectivos del Café
          </Link>

          <nav className="barra-menu" aria-label="Módulos">
            {enlaces}
          </nav>

          <div className="barra-usuario">
            <Link to="/cambiar-password" className="barra-nombre" title="Cambiar contraseña">
              {usuario.nombre.split(' ')[0]}
            </Link>
            <button type="button" className="boton-pildora" onClick={salir}>
              Salir
            </button>
          </div>

          <button
            type="button"
            className="boton-icono barra-abrir"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuAbierto}
          >
            {menuAbierto ? '✕' : '☰'}
          </button>
        </div>

        {/* Cortina del menú en celular */}
        <div className="cortina">
          <nav className="cortina-menu" aria-label="Módulos">
            {enlaces}
          </nav>
          <div className="cortina-cuenta">
            <span>{usuario.nombre}</span>
            <Link to="/cambiar-password" onClick={cerrarMenu}>
              Cambiar contraseña
            </Link>
            <button type="button" className="boton-pildora" onClick={salir}>
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="panel-contenido">
        <Outlet />
      </main>

      <footer className="pie">
        <div className="pie-interior">
          <span className="marca">Colectivos del Café</span>
          <span>{usuario.rol === 'admin' ? 'Administración' : 'Conductor'} · Pereira, Risaralda</span>
        </div>
      </footer>
    </div>
  );
}
