import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Los estilos base van primero: los de cada módulo y del layout los extienden.
import './compartido/estilos/base.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
