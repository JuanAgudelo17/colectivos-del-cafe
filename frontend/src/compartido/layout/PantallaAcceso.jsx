import { IlustracionBuseta } from '../ui/Ilustraciones.jsx';
import { Logo } from '../ui/Logo.jsx';
import { cieloBogota, hoyBogota } from '../utilidades/formato.js';
import './acceso.css';

// Pantallas sin sesión (login, recuperar, crear contraseña): barra negra,
// formulario a la izquierda e ilustración a la derecha (en celular, franja arriba), pie negro.
// La ilustración por defecto pinta el cielo según la hora de Bogotá.
export function PantallaAcceso({ ilustracion, children }) {
  return (
    <div className="acceso">
      <header className="acceso-barra">
        <span className="marca acceso-marca">
          <Logo tamano={28} />
          Colectivos del Café
        </span>
      </header>

      <main className="acceso-cuerpo">
        <section className="acceso-formulario">{children}</section>
        <aside className="acceso-ilustracion">
          {ilustracion ?? <IlustracionBuseta cielo={cieloBogota()} />}
        </aside>
      </main>

      <footer className="acceso-pie">
        <span className="marca">El Producido</span>
        <span>© {hoyBogota().slice(0, 4)} · Desarrollado por Juan Agudelo y Nicolás Valencia</span>
      </footer>
    </div>
  );
}
