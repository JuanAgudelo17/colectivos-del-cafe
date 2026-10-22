// Convierte la salida JSON de ESLint en:
//  - anotaciones de GitHub (aparecen en la línea exacta en "Files changed" del PR)
//  - un resumen JSON para el comentario del PR.
// Sale con código 1 si hay errores (las advertencias no fallan el CI).
// Uso: node reporte-lint.mjs <eslint.json> <salida.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const [entrada, salida] = process.argv.slice(2);
const raiz = resolve(import.meta.dirname, '..', '..');
const resultados = JSON.parse(readFileSync(entrada, 'utf8'));

// Los comandos de GitHub requieren escapar %, \r y \n (y , : en propiedades).
const escapar = (texto) => texto.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
const escaparPropiedad = (texto) => escapar(texto).replaceAll(':', '%3A').replaceAll(',', '%2C');

const problemas = [];
for (const archivo of resultados) {
  const ruta = relative(raiz, archivo.filePath).replaceAll('\\', '/');
  for (const m of archivo.messages) {
    const severidad = m.severity === 2 ? 'error' : 'advertencia';
    problemas.push({ archivo: ruta, linea: m.line ?? 1, columna: m.column ?? 1, regla: m.ruleId, mensaje: m.message, severidad });

    const comando = m.severity === 2 ? 'error' : 'warning';
    const titulo = escaparPropiedad(`ESLint${m.ruleId ? ` (${m.ruleId})` : ''}`);
    console.log(
      `::${comando} file=${escaparPropiedad(ruta)},line=${m.line ?? 1},col=${m.column ?? 1},title=${titulo}::${escapar(m.message)}`,
    );
  }
}

const resumen = {
  errores: problemas.filter((p) => p.severidad === 'error').length,
  advertencias: problemas.filter((p) => p.severidad === 'advertencia').length,
  problemas,
};
writeFileSync(salida, `${JSON.stringify(resumen, null, 2)}\n`);
console.log(`ESLint: ${resumen.errores} errores, ${resumen.advertencias} advertencias`);
process.exitCode = resumen.errores > 0 ? 1 : 0;
