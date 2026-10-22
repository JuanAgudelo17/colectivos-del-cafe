import { Link } from 'react-router';
import { EstadoDocumento } from '../../componentes/EstadoDocumento.jsx';
import { useSesion } from '../../sesion/contexto.js';
import { useDatos } from '../../utilidades/useDatos.js';

const URGENCIA = { vencido: 0, por_vencer: 1 };

// Resumen: totales y documentos vencidos o por vencer de todas las busetas activas.
export function InicioAdmin() {
  const { usuario } = useSesion();
  const empresas = useDatos('/empresas').datos?.empresas;
  const busetas = useDatos('/busetas').datos?.busetas;
  const conductores = useDatos('/conductores').datos?.conductores;

  const alertas = (busetas ?? [])
    .filter((b) => b.activo)
    .flatMap((b) =>
      [
        ['SOAT', b.documentos.soat],
        ['Tecnomecánica', b.documentos.tecnomecanica],
      ]
        .filter(([, d]) => d.estado in URGENCIA)
        .map(([nombre, documento]) => ({ buseta: b, nombre, documento })),
    )
    .sort((a, b) => a.documento.dias - b.documento.dias);

  const contar = (lista) => lista?.filter((x) => x.activo).length ?? '…';

  return (
    <>
      <h1>Hola, {usuario.nombre.split(' ')[0]}</h1>

      <div className="resumen">
        <Link to="/admin/empresas" className="tarjeta cifra">
          <strong>{contar(empresas)}</strong>
          <span>Empresas</span>
        </Link>
        <Link to="/admin/busetas" className="tarjeta cifra">
          <strong>{contar(busetas)}</strong>
          <span>Busetas</span>
        </Link>
        <Link to="/admin/conductores" className="tarjeta cifra">
          <strong>{contar(conductores)}</strong>
          <span>Conductores</span>
        </Link>
      </div>

      <section className="tarjeta">
        <h2>Documentos que requieren atención</h2>
        {busetas && alertas.length === 0 && <p className="ok">Todos los documentos están al día. ✅</p>}
        <ul className="lista-simple">
          {alertas.map(({ buseta, nombre, documento }) => (
            <li key={`${buseta.id}-${nombre}`}>
              <span className="placa">
                {buseta.numeroInterno} · {buseta.placa}
              </span>
              <EstadoDocumento nombre={nombre} documento={documento} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
