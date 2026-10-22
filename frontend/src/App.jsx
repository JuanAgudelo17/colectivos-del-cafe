import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Plantilla } from './componentes/Plantilla.jsx';
import { RutaProtegida } from './componentes/RutaProtegida.jsx';
import { InicioAdmin } from './paginas/InicioAdmin.jsx';
import { InicioConductor } from './paginas/InicioConductor.jsx';
import { Login } from './paginas/Login.jsx';
import { ProveedorSesion } from './sesion/ProveedorSesion.jsx';
import { rutaInicio, useSesion } from './sesion/contexto.js';

function RedirigirInicio() {
  const { usuario, cargando } = useSesion();
  if (cargando) return <p className="cargando">Cargando…</p>;
  return <Navigate to={usuario ? rutaInicio(usuario) : '/login'} replace />;
}

export default function App() {
  return (
    <ProveedorSesion>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<RutaProtegida rol="admin" />}>
            <Route element={<Plantilla />}>
              <Route path="/admin" element={<InicioAdmin />} />
            </Route>
          </Route>

          <Route element={<RutaProtegida rol="conductor" />}>
            <Route element={<Plantilla />}>
              <Route path="/conductor" element={<InicioConductor />} />
            </Route>
          </Route>

          <Route path="*" element={<RedirigirInicio />} />
        </Routes>
      </BrowserRouter>
    </ProveedorSesion>
  );
}
