import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useSesion } from '../sesion/contexto.js';
import { Icono } from '../ui/Iconos.jsx';
import './panel.css';

const CELULAR = '(max-width: 1024px)';

// true si se está viendo la barra del celular (y no la barra lateral).
function useEsCelular() {
  const [esCelular, setEsCelular] = useState(() => window.matchMedia(CELULAR).matches);
  useEffect(() => {
    const consulta = window.matchMedia(CELULAR);
    const cambiar = () => setEsCelular(consulta.matches);
    consulta.addEventListener('change', cambiar);
    return () => consulta.removeEventListener('change', cambiar);
  }, []);
  return esCelular;
}

// Estructura tipo panel para las pantallas con sesión: barra lateral negra con
// el menú del rol agrupado por secciones y el usuario abajo; contenido a la
// derecha. En celular la barra lateral se vuelve una barra superior con ☰.
// `menu`: [{ grupo, modulos: [{ id, titulo, icono, ruta, Pagina } | { id, titulo, icono, fase }] }]
// `acciones` (ej. la campanita) va en la barra lateral o en la del celular, en una sola.
export function Panel({ menu, base, acciones = null }) {
  const esCelular = useEsCelular();
  const { usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrarMenu = () => setMenuAbierto(false);
  const rol = usuario.rol === 'admin' ? 'Administración' : 'Conductor';
  const iniciales = usuario.nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  async function salir() {
    await cerrarSesion();
    navegar('/login', { replace: true });
  }

  const navegacion = (
    <nav className="lateral-menu" aria-label="Módulos">
      {menu.map(({ grupo, modulos }) => (
        <div key={grupo} className="lateral-grupo">
          <span className="lateral-titulo">{grupo}</span>
          {modulos.map((m) =>
            m.Pagina ? (
              <NavLink key={m.id} to={m.ruta ? `${base}/${m.ruta}` : base} end={!m.ruta} onClick={cerrarMenu}>
                <Icono nombre={m.icono} />
                {m.titulo}
              </NavLink>
            ) : (
              <span key={m.id} className="lateral-pendiente" title={`Llega en la Fase ${m.fase}`}>
                <Icono nombre={m.icono} />
                {m.titulo}
                <small>Fase {m.fase}</small>
              </span>
            ),
          )}
        </div>
      ))}
    </nav>
  );

  const cuenta = (
    <div className="lateral-usuario">
      <div className="lateral-persona">
        <span className="lateral-avatar" aria-hidden="true">
          {iniciales}
        </span>
        <div>
          <strong>{usuario.nombre}</strong>
          <small>{rol}</small>
        </div>
      </div>
      <div className="lateral-acciones">
        <Link to="/cambiar-password" onClick={cerrarMenu}>
          Cambiar contraseña
        </Link>
        <button type="button" className="boton-pildora" onClick={salir}>
          Salir
        </button>
      </div>
    </div>
  );

  return (
    <div className={menuAbierto ? 'panel panel-menu-abierto' : 'panel'}>
      {/* Computador: barra lateral fija */}
      <aside className="lateral">
        <div className="lateral-cabeza">
          <Link to={base} className="lateral-marca">
            <span className="marca">Colectivos del Café</span>
            <small>{rol}</small>
          </Link>
          {!esCelular && acciones}
        </div>
        {navegacion}
        {cuenta}
      </aside>

      {/* Celular: barra superior y menú a pantalla completa */}
      <header className="barra-movil">
        <Link to={base} className="marca" onClick={cerrarMenu}>
          Colectivos del Café
        </Link>
        <span className="barra-movil-acciones">
          {esCelular && acciones}
          <button
            type="button"
            className="boton-icono"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuAbierto}
          >
            {menuAbierto ? '✕' : '☰'}
          </button>
        </span>
      </header>
      <div className="cortina">
        {navegacion}
        {cuenta}
      </div>

      <main className="panel-contenido">
        <Outlet />
      </main>
    </div>
  );
}
