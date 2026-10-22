import { useState } from 'react';

// Muestra una contraseña temporal recién generada. El backend no la vuelve a entregar.
export function PasswordUnaVez({ usuario, password, alTerminar }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(
      `Usuario: ${usuario}\nContraseña temporal: ${password}\n` +
        `Entra en ${window.location.origin} y crea tu propia contraseña. Vence en 48 horas.`,
    );
    setCopiado(true);
  }

  return (
    <div className="password-una-vez">
      <p>
        Envíale estos datos al conductor. <strong>La contraseña no se vuelve a mostrar.</strong>
      </p>
      <dl>
        <dt>Usuario</dt>
        <dd>{usuario}</dd>
        <dt>Contraseña temporal</dt>
        <dd className="password">{password}</dd>
      </dl>
      <p className="ayuda">Vence en 48 horas. Al entrar, el sistema le pedirá crear su propia contraseña.</p>
      <div className="acciones">
        <button type="button" className="boton-secundario-oscuro" onClick={copiar}>
          {copiado ? 'Copiado ✓' : 'Copiar mensaje'}
        </button>
        <button type="button" className="boton-principal" onClick={alTerminar}>
          Listo
        </button>
      </div>
    </div>
  );
}
