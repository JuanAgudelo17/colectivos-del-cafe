import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Los estilos base van primero: los de cada módulo y del layout los extienden.
import './compartido/estilos/base.css';
import App from './App.jsx';
import { escucharErrores } from './compartido/errores.js';
import { LimiteErrores } from './compartido/ui/LimiteErrores.jsx';

escucharErrores();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LimiteErrores>
      <App />
    </LimiteErrores>
  </StrictMode>,
);
