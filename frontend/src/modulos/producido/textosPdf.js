// Textos de un PDF con su posición (x, y en puntos; y crece hacia arriba), leídos
// en el navegador: el archivo nunca sale del computador. pdf.js se carga solo al usarlo.
// `todas`: todas las hojas (si no, solo la primera); cada texto trae su `pagina`.
export async function textosDelPdf(archivo, { todas = false } = {}) {
  const [pdfjs, { default: trabajador }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = trabajador;
  const tarea = pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) });
  try {
    const documento = await tarea.promise;
    const textos = [];
    for (let pagina = 1; pagina <= (todas ? documento.numPages : 1); pagina++) {
      const { items } = await (await documento.getPage(pagina)).getTextContent();
      for (const it of items) {
        textos.push({ texto: it.str, x: it.transform[4], y: it.transform[5], ancho: it.width, pagina });
      }
    }
    return textos;
  } finally {
    tarea.destroy();
  }
}
