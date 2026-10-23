import { useState } from 'react';
import { IlustracionBuseta } from '../../compartido/ui/Ilustraciones.jsx';
import './busetas.css';

// Foto de la buseta o, si no tiene (o no carga), la ilustración.
// `src`: el endpoint que redirige a la URL firmada (admin o conductor).
// `foto` (la ruta guardada) va en la URL para que una foto nueva no salga de la caché.
export function FotoBuseta({ src, foto, alt }) {
  const [fallo, setFallo] = useState(null);
  if (!foto || fallo === foto) return <IlustracionBuseta />;
  return (
    <img
      className="foto-buseta"
      src={`/api${src}?v=${encodeURIComponent(foto)}`}
      alt={alt}
      onError={() => setFallo(foto)}
    />
  );
}
