import { Campo } from '../../compartido/ui/Campos.jsx';

// Lectura del odómetro: muestra separadores de miles y guarda un número (o null si está vacío).
export function CampoKilometraje({ etiqueta, error, ayuda, valor, alCambiar, ...props }) {
  const texto = valor == null ? '' : valor.toLocaleString('es-CO');
  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <div className="entrada-km">
        <input
          inputMode="numeric"
          value={texto}
          onChange={(e) => {
            const digitos = e.target.value.replace(/\D/g, '').slice(0, 7);
            alCambiar(digitos ? Number(digitos) : null);
          }}
          aria-invalid={Boolean(error)}
          {...props}
        />
        <span>km</span>
      </div>
    </Campo>
  );
}
