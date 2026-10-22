// Reporter de `node --test` para el CI: produce un JSON con el resumen y el
// detalle de cada prueba fallida, que luego se publica como comentario en el PR.
// Uso: node --test --test-reporter=./compartido/test/reporte-ci.js --test-reporter-destination=archivo.json
import { relative, resolve } from 'node:path';

const RAIZ_REPO = resolve(process.cwd(), '..');
const MAX_LINEAS_ERROR = 8;

function mensajeDe(error) {
  const causa = error?.cause ?? error;
  const texto = String(causa?.message ?? causa ?? 'Error desconocido').trim();
  const lineas = texto.split('\n');
  const corto = lineas.slice(0, MAX_LINEAS_ERROR).join('\n');
  return lineas.length > MAX_LINEAS_ERROR ? `${corto}\n…` : corto;
}

const rutaRelativa = (archivo) => (archivo ? relative(RAIZ_REPO, archivo).replaceAll('\\', '/') : null);

export default async function* reporteCi(eventos) {
  const resumen = { total: 0, pasaron: 0, fallaron: 0, omitidas: 0, fallos: [] };
  // Nombre de cada nivel (describe › test) por archivo, para mostrar la ruta completa.
  const rutas = new Map();

  for await (const { type, data } of eventos) {
    if (type === 'test:start') {
      const ruta = rutas.get(data.file) ?? [];
      ruta[data.nesting] = data.name;
      ruta.length = data.nesting + 1;
      rutas.set(data.file, ruta);
      continue;
    }
    if (type !== 'test:pass' && type !== 'test:fail') continue;

    // Un describe "falla" cuando falla algo adentro: ya se cuenta la prueba hija.
    const esSuite = data.details?.type === 'suite';
    if (type === 'test:fail' && data.details?.error?.failureType === 'subtestsFailed') continue;
    if (esSuite && type === 'test:pass') continue;

    if (type === 'test:pass') {
      resumen.total++;
      if (data.skip || data.todo) resumen.omitidas++;
      else resumen.pasaron++;
      continue;
    }

    resumen.total++;
    resumen.fallaron++;
    const padres = (rutas.get(data.file) ?? []).slice(0, data.nesting);
    resumen.fallos.push({
      nombre: [...padres, data.name].join(' › '),
      archivo: rutaRelativa(data.file),
      linea: data.line ?? null,
      mensaje: mensajeDe(data.details?.error),
    });
  }

  yield `${JSON.stringify(resumen, null, 2)}\n`;
}
