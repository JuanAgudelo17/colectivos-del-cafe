import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Panel } from './compartido/layout/Panel.jsx';
import { RutaProtegida } from './compartido/sesion/RutaProtegida.jsx';
import { ProveedorSesion } from './compartido/sesion/ProveedorSesion.jsx';
import { rutaInicio, useSesion } from './compartido/sesion/contexto.js';
import { CambiarPassword } from './modulos/cuenta/CambiarPassword.jsx';
import { menuAdmin, menuConductor, modulosAdmin, modulosConductor } from './modulos/index.js';
import { Login } from './modulos/login/Login.jsx';
import { Recuperar } from './modulos/login/Recuperar.jsx';

function RedirigirInicio() {
  const { usuario, cargando } = useSesion();
  if (cargando) return <p className="cargando">Cargando…</p>;
  return <Navigate to={usuario ? rutaInicio(usuario) : '/login'} replace />;
}

// Rutas de un rol a partir de sus módulos registrados (solo los que ya tienen página).
// `subrutas` (opcional): páginas internas del módulo, ej. busetas/:id.
function rutasDe(modulos) {
  return modulos
    .filter((m) => m.Pagina)
    .flatMap(({ id, ruta, Pagina, subrutas = [] }) => [
      ruta ? <Route key={id} path={ruta} element={<Pagina />} /> : <Route key={id} index element={<Pagina />} />,
      ...subrutas.map((s) => <Route key={`${id}/${s.ruta}`} path={`${ruta}/${s.ruta}`} element={<s.Pagina />} />),
    ]);
}

export default function App() {
  return (
    <ProveedorSesion>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar" element={<Recuperar />} />

          <Route element={<RutaProtegida permitirPasswordTemporal />}>
            <Route path="/cambiar-password" element={<CambiarPassword />} />
          </Route>

          <Route element={<RutaProtegida rol="admin" />}>
            <Route path="/admin" element={<Panel menu={menuAdmin} base="/admin" />}>
              {rutasDe(modulosAdmin)}
            </Route>
          </Route>

          <Route element={<RutaProtegida rol="conductor" />}>
            <Route path="/conductor" element={<Panel menu={menuConductor} base="/conductor" />}>
              {rutasDe(modulosConductor)}
            </Route>
          </Route>

          <Route path="*" element={<RedirigirInicio />} />
        </Routes>
      </BrowserRouter>
    </ProveedorSesion>
  );
}
