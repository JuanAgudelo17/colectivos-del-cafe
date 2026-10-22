import { IlustracionBuseta } from '../ui/Ilustraciones.jsx';
import './acceso.css';

// Pantallas sin sesión (login, recuperar, crear contraseña): barra negra,
// formulario a la izquierda e ilustración a la derecha, pie negro.
export function PantallaAcceso({ ilustracion = <IlustracionBuseta />, children }) {
  return (
    <div className="acceso">
      <header className="acceso-barra">
        <span className="marca">Colectivos del Café</span>
      </header>

      <main className="acceso-cuerpo">
        <section className="acceso-formulario">{children}</section>
        <aside className="acceso-ilustracion">{ilustracion}</aside>
      </main>

      <footer className="acceso-pie">
        <span className="marca">Colectivos del Café</span>
        <span>Transporte intermunicipal · Pereira, Risaralda</span>
      </footer>
    </div>
  );
}
