import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Panel } from './compartido/layout/Panel.jsx';
import { RutaProtegida } from './compartido/sesion/RutaProtegida.jsx';
import { ProveedorSesion } from './compartido/sesion/ProveedorSesion.jsx';
import { rutaInicio, useSesion } from './compartido/sesion/contexto.js';
import { modulosAdmin, modulosConductor } from './modulos/index.js';
import { Login } from './modulos/login/Login.jsx';

function RedirigirInicio() {
  const { usuario, cargando } = useSesion();
  if (cargando) return <p className="cargando">Cargando…</p>;
  return <Navigate to={usuario ? rutaInicio(usuario) : '/login'} replace />;
}

// Rutas de un rol a partir de sus módulos registrados (solo los que ya tienen página).
function rutasDe(modulos) {
  return modulos
    .filter((m) => m.Pagina)
    .map(({ id, ruta, Pagina }) =>
      ruta ? <Route key={id} path={ruta} element={<Pagina />} /> : <Route key={id} index element={<Pagina />} />,
    );
}

export default function App() {
  return (
    <ProveedorSesion>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<RutaProtegida rol="admin" />}>
            <Route path="/admin" element={<Panel modulos={modulosAdmin} base="/admin" />}>
              {rutasDe(modulosAdmin)}
            </Route>
          </Route>

          <Route element={<RutaProtegida rol="conductor" />}>
            <Route path="/conductor" element={<Panel modulos={modulosConductor} base="/conductor" />}>
              {rutasDe(modulosConductor)}
            </Route>
          </Route>

          <Route path="*" element={<RedirigirInicio />} />
        </Routes>
      </BrowserRouter>
    </ProveedorSesion>
  );
}
