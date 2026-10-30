// Iconos de línea monocromos: toman el color del texto (currentColor).
const TRAZOS = {
  inicio: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  buseta: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M3 11h18M8 4v7M16 4v7" />
      <circle cx="7.5" cy="19" r="1.5" />
      <circle cx="16.5" cy="19" r="1.5" />
    </>
  ),
  persona: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </>
  ),
  dinero: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  factura: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  cierre: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  alerta: (
    <>
      <path d="M12 3.5 2.5 20h19L12 3.5Z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.5v.01" />
    </>
  ),
  campana: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  ranking: (
    <>
      <path d="M3 21h18" />
      <rect x="9" y="5" width="6" height="16" rx="1" />
      <rect x="3" y="11" width="6" height="10" rx="1" />
      <rect x="15" y="14" width="6" height="7" rx="1" />
    </>
  ),
  peaje: (
    <>
      <path d="M4 21V4" />
      <rect x="4" y="5" width="17" height="5" rx="1" />
      <path d="M9 5l-2 5M14 5l-2 5M19 5l-2 5" />
    </>
  ),
  grafica: (
    <>
      <path d="M3 20h18" />
      <path d="M4 16l5-5 4 3 7-8" />
      <path d="M15 6h5v5" />
    </>
  ),
  documento: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 13h6M10 17h6" />
    </>
  ),
  ojo: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  ojoTachado: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 4l16 16" />
    </>
  ),
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
  listo: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  mayusculas: (
    <>
      <path d="M12 4l-8 8h4v4h8v-4h4z" />
      <path d="M8 20h8" />
    </>
  ),
  enviar: (
    <>
      <path d="M21 3L10 14" />
      <path d="M21 3l-7 18-4-7-7-4z" />
    </>
  ),
  llave: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M16 7l3 3M14 9l2 2" />
    </>
  ),
  candado: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
};

export function Icono({ nombre, tamano = 20 }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
