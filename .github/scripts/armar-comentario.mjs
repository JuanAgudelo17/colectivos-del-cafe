// Arma el comentario del PR (Markdown) a partir de los reportes del CI.
// Uso: node armar-comentario.mjs <carpeta-reportes> <salida.md>
// Variables: BACKEND_PRUEBAS, FRONTEND_LINT, FRONTEND_BUILD (outcome de cada paso:
// success | failure | skipped | cancelled), URL_EJECUCION, COMMIT.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MARCA = '<!-- ci-colectivos -->';
const MAX_FALLOS = 15;
const MAX_PROBLEMAS_LINT = 20;

const [carpeta, salida] = process.argv.slice(2);
const env = process.env;

function leer(nombre) {
  const ruta = join(carpeta, nombre);
  return existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : null;
}

const pruebas = leer('reporte-backend.json');
const lint = leer('reporte-lint.json');

const ICONO = { success: '✅', failure: '❌', skipped: '⏭️', cancelled: '⏹️' };
const icono = (resultado) => ICONO[resultado] ?? '❔';
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// ---- Fila de cada revisión ---------------------------------------------------

function filaPruebas() {
  if (!pruebas) {
    return `| Pruebas del backend | ${icono(env.BACKEND_PRUEBAS)} | No se generó el reporte (¿falló la instalación?). Mira el log. |`;
  }
  const { total, pasaron, fallaron, omitidas } = pruebas;
  const detalle = fallaron
    ? `**${fallaron} de ${total} fallaron**`
    : `${pasaron} de ${total} pasaron${omitidas ? ` (${omitidas} omitidas)` : ''}`;
  return `| Pruebas del backend | ${fallaron ? '❌' : '✅'} | ${detalle} |`;
}

function filaLint() {
  if (!lint) return `| Lint del frontend | ${icono(env.FRONTEND_LINT)} | No se generó el reporte. Mira el log. |`;
  if (lint.errores) {
    return `| Lint del frontend | ❌ | **${plural(lint.errores, 'error', 'errores')}**, ${plural(lint.advertencias, 'advertencia', 'advertencias')} |`;
  }
  if (lint.advertencias) {
    return `| Lint del frontend | ⚠️ | ${plural(lint.advertencias, 'advertencia', 'advertencias')} (no bloquean) |`;
  }
  return '| Lint del frontend | ✅ | Sin problemas |';
}

function filaBuild() {
  const textos = {
    success: 'Compila',
    failure: '**No compila**: revisa el log',
    skipped: 'No se ejecutó',
  };
  return `| Build del frontend | ${icono(env.FRONTEND_BUILD)} | ${textos[env.FRONTEND_BUILD] ?? env.FRONTEND_BUILD ?? '—'} |`;
}

// ---- Detalle de fallos -------------------------------------------------------

function detallePruebas() {
  if (!pruebas?.fallos.length) return '';
  const lista = pruebas.fallos.slice(0, MAX_FALLOS).map((f) => {
    const donde = f.archivo ? ` — \`${f.archivo}${f.linea ? `:${f.linea}` : ''}\`` : '';
    return `**${f.nombre}**${donde}\n\`\`\`\n${f.mensaje}\n\`\`\``;
  });
  const resto = pruebas.fallos.length > MAX_FALLOS ? `\n…y ${pruebas.fallos.length - MAX_FALLOS} más (ver el log).` : '';
  return `\n### ❌ Pruebas que fallaron\n\n${lista.join('\n\n')}${resto}\n`;
}

function detalleLint() {
  if (!lint?.problemas.length) return '';
  const filas = lint.problemas
    .slice(0, MAX_PROBLEMAS_LINT)
    .map(
      (p) =>
        `| ${p.severidad === 'error' ? '❌' : '⚠️'} | \`${p.archivo}:${p.linea}\` | ${p.mensaje.replaceAll('|', '\\|')} | ${p.regla ? `\`${p.regla}\`` : ''} |`,
    );
  const resto =
    lint.problemas.length > MAX_PROBLEMAS_LINT ? `\n…y ${lint.problemas.length - MAX_PROBLEMAS_LINT} más.` : '';
  return `\n### Lint\n\n| | Dónde | Problema | Regla |\n|---|---|---|---|\n${filas.join('\n')}${resto}\n\nTambién aparecen marcados en la línea exacta en la pestaña **Files changed**.\n`;
}

// ---- Comentario completo -----------------------------------------------------

const hayFallos =
  (pruebas ? pruebas.fallaron > 0 : env.BACKEND_PRUEBAS !== 'success') ||
  (lint ? lint.errores > 0 : env.FRONTEND_LINT !== 'success') ||
  env.FRONTEND_BUILD !== 'success';

const titulo = hayFallos
  ? '## ❌ El CI encontró problemas\nCorrígelos y haz push a esta misma rama: este comentario se actualiza solo.'
  : '## ✅ Todo pasó\nPruebas, lint y build en verde. Listo para revisión.';

const pie = [
  env.COMMIT && `Commit \`${env.COMMIT.slice(0, 7)}\``,
  env.URL_EJECUCION && `[ver ejecución completa](${env.URL_EJECUCION})`,
]
  .filter(Boolean)
  .join(' · ');

const comentario = `${MARCA}
${titulo}

| Revisión | | Resultado |
|---|---|---|
${filaPruebas()}
${filaLint()}
${filaBuild()}
${detallePruebas()}${detalleLint()}
<sub>${pie}</sub>
`;

writeFileSync(salida, comentario);
console.log(comentario);
