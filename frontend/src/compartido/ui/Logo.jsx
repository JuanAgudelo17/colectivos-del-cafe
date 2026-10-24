// La buseta del favicon dentro de un cuadro. El cuadro toma el color del texto
// (blanco sobre la barra negra) y la buseta va en negro.
export function Logo({ tamano = 32 }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 32 32" className="logo" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <rect x="6" y="9" width="20" height="13" rx="2" fill="#000" />
      <rect x="8" y="11" width="7" height="5" rx="1" fill="currentColor" />
      <rect x="17" y="11" width="7" height="5" rx="1" fill="currentColor" />
      <circle cx="11" cy="23" r="2.2" fill="#000" />
      <circle cx="21" cy="23" r="2.2" fill="#000" />
    </svg>
  );
}
