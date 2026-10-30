import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useSesion } from '../sesion/contexto.js';
import { AvisoSinConexion } from '../ui/AvisoSinConexion.jsx';
import { Icono } from '../ui/Iconos.jsx';
import { Logo } from '../ui/Logo.jsx';
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
// Fuera del inicio hay una flecha para volver (en la barra del celular o arriba
// del contenido en el computador).
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

  // Flecha para volver (en la app instalada no hay botón de atrás del navegador).
  // Vuelve a la página anterior; si se entró directo (ej. desde un aviso), sube
  // a la sección de arriba (/admin/busetas/3 → /admin/busetas).
  const { pathname, hash, key } = useLocation();
  const enInicio = pathname.replace(/\/$/, '') === base;
  function volver() {
    cerrarMenu();
    // key 'default' = primera página que se abrió (no hay a dónde volver dentro de la app).
    if (key !== 'default') return navegar(-1);
    const arriba = pathname.replace(/\/[^/]+\/?$/, '');
    navegar(arriba.length >= base.length ? arriba : base);
  }

  // Enlaces con #sección (ej. los avisos de mantenimiento abren /conductor#mantenimiento):
  // el router no baja solo. Las páginas cargan por partes, así que se reintenta
  // un par de veces mientras se acomoda. Cada navegación (aunque sea a la misma
  // dirección) tiene otra `key`, así que tocar el mismo aviso vuelve a bajar.
  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    const intentos = [150, 700, 1600].map((ms) =>
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), ms),
    );
    return () => intentos.forEach(clearTimeout);
  }, [hash, key]);

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
            <span className="marca">
              <Logo tamano={26} /> El Producido
            </span>
            <small>{rol}</small>
          </Link>
          {!esCelular && acciones}
        </div>
        {navegacion}
        {cuenta}
      </aside>

      {/* Celular: barra superior y menú a pantalla completa */}
      <header className="barra-movil">
        <span className="barra-movil-marca">
          {!enInicio && (
            <button type="button" className="boton-icono boton-volver" onClick={volver} aria-label="Volver">
              ‹
            </button>
          )}
          <Link to={base} className="marca" onClick={cerrarMenu}>
            <Logo tamano={24} /> El Producido
          </Link>
        </span>
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
      {/* En el celular la cuenta (y Salir) va arriba: abajo la tapan otras barras. */}
      <div className="cortina">
        {cuenta}
        {navegacion}
      </div>

      <main className="panel-contenido">
        <AvisoSinConexion />
        {!enInicio && (
          <button type="button" className="volver-escritorio" onClick={volver}>
            ‹ Atrás
          </button>
        )}
        <Outlet />
      </main>
    </div>
  );
}
