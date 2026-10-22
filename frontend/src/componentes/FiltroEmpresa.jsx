// Selector "Empresa: Todas / X / Y". Se oculta si el admin solo maneja una empresa.
export function FiltroEmpresa({ empresas, valor, alCambiar }) {
  if (!empresas || empresas.length < 2) return null;

  return (
    <label className="filtro">
      <span>Empresa</span>
      <select value={valor ?? ''} onChange={(e) => alCambiar(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Todas</option>
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
            {!e.activo && ' (inactiva)'}
          </option>
        ))}
      </select>
    </label>
  );
}
