import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Los estilos base van primero: los de cada módulo y del layout los extienden.
import './compartido/estilos/base.css';
import App from './App.jsx';
import { escucharErrores } from './compartido/errores.js';
import { LimiteErrores } from './compartido/ui/LimiteErrores.jsx';

escucharErrores();

// Service worker: notificaciones push y la app sin señal (ver public/sw.js).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LimiteErrores>
      <App />
    </LimiteErrores>
  </StrictMode>,
);
