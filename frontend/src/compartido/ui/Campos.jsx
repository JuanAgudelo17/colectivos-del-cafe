// Campos de formulario con etiqueta y mensaje de error debajo.

export function Campo({ etiqueta, error, ayuda, children }) {
  return (
    <label className={error ? 'campo campo-con-error' : 'campo'}>
      <span>{etiqueta}</span>
      {children}
      {error ? <small className="error">{error}</small> : ayuda && <small className="ayuda">{ayuda}</small>}
    </label>
  );
}

export function CampoTexto({ etiqueta, error, ayuda, valor, alCambiar, ...props }) {
  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <input value={valor ?? ''} onChange={(e) => alCambiar(e.target.value)} aria-invalid={Boolean(error)} {...props} />
    </Campo>
  );
}

// Valor en pesos: muestra separadores de miles y guarda un número (o null si está vacío).
export function CampoPesos({ etiqueta, error, ayuda, valor, alCambiar, ...props }) {
  const texto = valor == null ? '' : valor.toLocaleString('es-CO');
  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <div className="entrada-pesos">
        <span>$</span>
        <input
          inputMode="numeric"
          value={texto}
          onChange={(e) => {
            const digitos = e.target.value.replace(/\D/g, '');
            alCambiar(digitos ? Number(digitos) : null);
          }}
          aria-invalid={Boolean(error)}
          {...props}
        />
      </div>
    </Campo>
  );
}

export function CampoSeleccion({ etiqueta, error, ayuda, valor, alCambiar, opciones, vacio, ...props }) {
  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <select
        value={valor ?? ''}
        onChange={(e) => alCambiar(e.target.value === '' ? null : Number(e.target.value))}
        aria-invalid={Boolean(error)}
        {...props}
      >
        {vacio !== undefined && <option value="">{vacio}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </Campo>
  );
}

export function Interruptor({ etiqueta, valor, alCambiar }) {
  return (
    <label className="interruptor">
      <input type="checkbox" checked={valor} onChange={(e) => alCambiar(e.target.checked)} />
      <span>{etiqueta}</span>
    </label>
  );
}
