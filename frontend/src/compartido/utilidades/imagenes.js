// Comprime una foto en el navegador antes de subirla (los datos del celular son
// caros y el servidor acepta hasta 3 MB). La librería se carga solo al usarla.
export async function comprimirImagen(archivo, { maxMB = 0.5, maxLado = 1600 } = {}) {
  if (!archivo.type.startsWith('image/')) throw new Error('El archivo no es una imagen');
  const { default: imageCompression } = await import('browser-image-compression');
  return imageCompression(archivo, {
    maxSizeMB: maxMB,
    maxWidthOrHeight: maxLado,
    fileType: 'image/jpeg',
    useWebWorker: true,
  });
}
