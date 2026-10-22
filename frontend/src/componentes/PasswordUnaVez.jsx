import { useState } from 'react';

// Muestra una contraseña recién generada. El backend no la vuelve a entregar.
export function PasswordUnaVez({ usuario, password, alTerminar }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(`Usuario: ${usuario}\nContraseña: ${password}`);
    setCopiado(true);
  }

  return (
    <div className="password-una-vez">
      <p>Entrégale estos datos al conductor. <strong>La contraseña no se vuelve a mostrar.</strong></p>
      <dl>
        <dt>Usuario</dt>
        <dd>{usuario}</dd>
        <dt>Contraseña</dt>
        <dd className="password">{password}</dd>
      </dl>
      <div className="acciones">
        <button type="button" className="boton-secundario-oscuro" onClick={copiar}>
          {copiado ? 'Copiado ✓' : 'Copiar'}
        </button>
        <button type="button" className="boton-principal" onClick={alTerminar}>
          Listo, ya la guardé
        </button>
      </div>
    </div>
  );
}
