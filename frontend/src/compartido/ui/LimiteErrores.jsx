import { Component } from 'react';
import { reportarError } from '../errores.js';

// Si una pantalla se rompe, en vez de quedar en blanco muestra un mensaje con
// un botón para recargar, y reporta el error (al admin le llega el aviso).
export class LimiteErrores extends Component {
  state = { roto: false };

  static getDerivedStateFromError() {
    return { roto: true };
  }

  componentDidCatch(error, info) {
    reportarError(error, { detalle: info?.componentStack });
  }

  render() {
    if (!this.state.roto) return this.props.children;
    return (
      <main className="pantalla-error" role="alert">
        <h1>Algo salió mal</h1>
        <p>Ya le avisamos al administrador. Recarga la página para seguir.</p>
        <button type="button" className="boton-principal" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </main>
    );
  }
}
