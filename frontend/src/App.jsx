import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function App() {
  const [estado, setEstado] = useState({ cargando: true });

  useEffect(() => {
    api('/salud')
      .then((datos) => setEstado({ ok: true, hora: datos.hora }))
      .catch((err) => setEstado({ ok: false, error: err.message }));
  }, []);

  return (
    <main className="contenedor">
      <h1>Colectivos del Café</h1>
      <p className="subtitulo">Registro contable de busetas</p>

      <section className="tarjeta">
        <h2>Estado del sistema</h2>
        {estado.cargando && <p>Verificando conexión…</p>}
        {estado.ok === true && (
          <p className="ok">
            Backend OK · {estado.hora} (hora Bogotá)
          </p>
        )}
        {estado.ok === false && <p className="error">{estado.error}</p>}
      </section>
    </main>
  );
}
