// Ilustraciones planas: el único lugar de la interfaz donde vive el color.
// Sin degradados ni sombras; formas de borde duro. Decorativas (aria-hidden).

// Colores de la escena según la hora (cieloBogota en utilidades/formato.js).
const CIELOS = {
  dia: {
    cielo: '#f3e3c7',
    montanaAtras: '#1f5f5b',
    montanaFrente: '#2f7a55',
    surcos: '#1d5a3c',
    carretera: '#3a3a3a',
    ventanas: '#cfe6ec',
  },
  atardecer: {
    cielo: '#f4b183',
    montanaAtras: '#2a4f5a',
    montanaFrente: '#3d6b4f',
    surcos: '#2b4a35',
    carretera: '#363636',
    ventanas: '#ffe0b8',
  },
  noche: {
    cielo: '#1b2a49',
    montanaAtras: '#12333a',
    montanaFrente: '#1a4a3a',
    surcos: '#143829',
    carretera: '#2a2a2a',
    ventanas: '#f6d26b',
  },
};

// Rayas de la carretera cada 108 unidades. Sobran por la derecha para que, al
// animarlas (acceso.css), la vía nunca se vea vacía.
const RAYAS = Array.from({ length: 9 }, (_, i) => {
  const x = 24 + 108 * i;
  const y = 436 - 8 * i;
  return `${x},${y} ${x + 60},${y - 5} ${x + 60},${y + 1} ${x},${y + 6}`;
});

// Una buseta subiendo por las montañas cafeteras, con palmas de cera.
// Al recortarse se alinea abajo para que siempre se vea la buseta.
// Las clases ilustracion-* solo se animan dentro de las pantallas de acceso.
export function IlustracionBuseta({ cielo = 'dia' }) {
  const c = CIELOS[cielo] ?? CIELOS.dia;
  const noche = cielo === 'noche';

  return (
    <svg
      viewBox="0 0 480 480"
      preserveAspectRatio="xMidYMax slice"
      className="ilustracion"
      style={{ '--foco': '70%' }} // franja del celular: centrada en la buseta
      aria-hidden="true"
      focusable="false"
    >
      <rect width="480" height="480" fill={c.cielo} />

      {/* Sol o luna */}
      <g className="ilustracion-astro">
        {noche ? (
          <>
            <g fill="#f3e3c7">
              <circle cx="56" cy="64" r="2.5" />
              <circle cx="132" cy="108" r="2" />
              <circle cx="204" cy="48" r="2.5" />
              <circle cx="262" cy="118" r="2" />
              <circle cx="300" cy="40" r="2" />
              <circle cx="440" cy="186" r="2.5" />
              <circle cx="40" cy="170" r="2" />
            </g>
            <circle cx="372" cy="104" r="40" fill="#f3e3c7" />
            <circle cx="390" cy="90" r="36" fill={c.cielo} />
          </>
        ) : cielo === 'atardecer' ? (
          <circle cx="372" cy="196" r="64" fill="#d9542b" />
        ) : (
          <circle cx="372" cy="104" r="52" fill="#e8743b" />
        )}
      </g>

      {/* Montañas */}
      <polygon points="0,290 110,150 220,270 320,170 480,300 480,480 0,480" fill={c.montanaAtras} />
      <polygon points="0,330 140,230 270,320 390,250 480,300 480,480 0,480" fill={c.montanaFrente} />

      {/* Surcos de café */}
      <g fill={c.surcos}>
        <circle cx="60" cy="330" r="7" />
        <circle cx="90" cy="318" r="7" />
        <circle cx="120" cy="306" r="7" />
        <circle cx="80" cy="352" r="7" />
        <circle cx="110" cy="340" r="7" />
        <circle cx="140" cy="328" r="7" />
        <circle cx="330" cy="300" r="7" />
        <circle cx="360" cy="290" r="7" />
        <circle cx="390" cy="300" r="7" />
        <circle cx="350" cy="322" r="7" />
        <circle cx="380" cy="312" r="7" />
        <circle cx="410" cy="322" r="7" />
      </g>

      {/* Palmas de cera */}
      <rect x="196" y="196" width="5" height="120" fill="#7a4a2a" />
      <polygon points="198,196 168,208 198,202 228,208" fill={c.montanaFrente} />
      <polygon points="198,192 176,180 198,198 220,180" fill={c.montanaAtras} />
      <rect x="252" y="226" width="4" height="96" fill="#7a4a2a" />
      <polygon points="254,226 230,236 254,231 278,236" fill={c.montanaFrente} />

      {/* Carretera */}
      <polygon points="0,388 480,356 480,480 0,480" fill={c.carretera} />
      <g fill="#f3e3c7" className="ilustracion-rayas">
        {RAYAS.map((puntos) => (
          <polygon key={puntos} points={puntos} />
        ))}
      </g>

      {/* Buseta */}
      <g transform="translate(118 262) rotate(-3.8)">
        <g className="ilustracion-buseta">
          {noche && <polygon points="236,94 340,74 340,128 236,106" fill="#f6d26b" opacity="0.35" />}
          <rect x="0" y="22" width="236" height="92" rx="10" fill="#276ef1" />
          <rect x="0" y="22" width="236" height="16" rx="8" fill="#ffffff" />
          <rect x="16" y="46" width="44" height="30" rx="3" fill={c.ventanas} />
          <rect x="68" y="46" width="44" height="30" rx="3" fill={c.ventanas} />
          <rect x="120" y="46" width="44" height="30" rx="3" fill={c.ventanas} />
          <rect x="174" y="46" width="28" height="56" rx="3" fill="#1b4fb0" />
          <polygon points="210,46 236,46 236,86 210,86" fill={c.ventanas} />
          <rect x="0" y="86" width="236" height="8" fill="#ffffff" />
          <rect x="226" y="96" width="10" height="8" fill={noche ? '#f6d26b' : '#e8743b'} />
          <circle cx="52" cy="116" r="20" fill="#111111" />
          <circle cx="52" cy="116" r="8" fill="#afafaf" />
          <circle cx="186" cy="116" r="20" fill="#111111" />
          <circle cx="186" cy="116" r="8" fill="#afafaf" />
        </g>
      </g>
    </svg>
  );
}

// Un candado y un celular: para crear o recuperar la contraseña.
export function IlustracionLlave() {
  return (
    <svg
      viewBox="0 0 480 480"
      preserveAspectRatio="xMidYMid slice"
      className="ilustracion"
      style={{ '--foco': '52%' }} // franja del celular: centrada en el candado
      aria-hidden="true"
      focusable="false"
    >
      <rect width="480" height="480" fill="#cfe6ec" />
      <circle cx="96" cy="96" r="44" fill="#e9c99a" />
      <polygon points="0,380 160,300 300,360 480,280 480,480 0,480" fill="#1f5f5b" />

      {/* Celular */}
      <rect x="148" y="96" width="168" height="300" rx="20" fill="#111111" />
      <rect x="160" y="124" width="144" height="240" rx="6" fill="#ffffff" />
      <rect x="182" y="152" width="100" height="10" fill="#d9d9d9" />
      <rect x="182" y="174" width="70" height="10" fill="#d9d9d9" />
      <g fill="#111111">
        <circle cx="196" cy="320" r="6" />
        <circle cx="218" cy="320" r="6" />
        <circle cx="240" cy="320" r="6" />
        <circle cx="262" cy="320" r="6" />
      </g>

      {/* Candado */}
      <path d="M284 236 v-34 a40 40 0 0 1 80 0 v34" fill="none" stroke="#7a4a2a" strokeWidth="16" />
      <rect x="262" y="230" width="124" height="104" rx="10" fill="#e8743b" />
      <circle cx="324" cy="272" r="12" fill="#7a4a2a" />
      <rect x="318" y="276" width="12" height="30" fill="#7a4a2a" />

      {/* Mensaje */}
      <rect x="70" y="214" width="110" height="56" rx="8" fill="#276ef1" />
      <polygon points="96,270 110,270 92,290" fill="#276ef1" />
      <rect x="86" y="232" width="62" height="8" fill="#ffffff" />
      <rect x="86" y="248" width="40" height="8" fill="#ffffff" />
    </svg>
  );
}
