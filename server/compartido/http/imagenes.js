// Imágenes que suben los usuarios (foto de la buseta; luego, las facturas).
// Llegan ya comprimidas desde el navegador como el cuerpo crudo de la petición.
import express from 'express';
import { ErrorHttp } from './errores.js';

export const TIPOS_IMAGEN = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const LIMITE_IMAGEN = 3 * 1024 * 1024;

const leerCuerpo = express.raw({ type: Object.keys(TIPOS_IMAGEN), limit: LIMITE_IMAGEN });

// Middleware: deja la imagen en req.body (Buffer) y da un mensaje claro si pesa demasiado.
export function recibirImagen(req, res, next) {
  leerCuerpo(req, res, (err) => {
    if (err?.type === 'entity.too.large') return next(new ErrorHttp(413, 'La imagen pesa más de 3 MB'));
    next(err);
  });
}

// Revisa que el contenido sea de verdad una imagen del tipo declarado (por sus
// primeros bytes), no solo que lo diga la cabecera. Devuelve la extensión.
export function validarImagen(req) {
  const tipo = req.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  const ext = TIPOS_IMAGEN[tipo];
  const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const firmas = {
    jpg: () => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    png: () => bytes.subarray(0, 4).toString('hex') === '89504e47',
    webp: () => bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP',
  };
  if (!ext || bytes.length === 0 || !firmas[ext]()) {
    throw new ErrorHttp(400, 'Sube una imagen JPG, PNG o WebP');
  }
  return { ext, tipo, contenido: bytes };
}
