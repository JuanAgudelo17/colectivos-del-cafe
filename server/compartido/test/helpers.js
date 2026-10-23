// Utilidades para las pruebas de todos los módulos.
import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcryptjs';
import { aplicarMigraciones } from '../bd/migraciones.js';
import { PARSERS } from '../bd/tipos.js';
import { firmarToken } from '../seguridad/sesion.js';

process.env.JWT_SECRET ??= 'secreto-de-pruebas-con-mas-de-32-caracteres';

// Base de datos en memoria con todas las migraciones aplicadas.
export async function crearBdPrueba() {
  const db = new PGlite({ parsers: PARSERS });
  await aplicarMigraciones(db);
  return db;
}

// Costo bajo de bcrypt para que las pruebas sean rápidas.
export const hashPrueba = (password) => bcrypt.hash(password, 4);

// Crea un usuario y devuelve { id, cookie } para hacer peticiones con su sesión.
export async function crearUsuario(db, { usuario, rol = 'admin', busetaId = null, password = 'clave-correcta', activo = true }) {
  const { rows } = await db.query(
    `INSERT INTO usuario (usuario, nombre, password_hash, rol, buseta_id, activo)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [usuario, `Nombre ${usuario}`, await hashPrueba(password), rol, busetaId, activo],
  );
  const id = rows[0].id;
  return { id, cookie: `sesion=${await firmarToken(id)}` };
}

export async function iniciarServidor(app) {
  const servidor = app.listen(0);
  await new Promise((resolve) => servidor.once('listening', resolve));
  const base = `http://localhost:${servidor.address().port}`;

  // pedir('POST', '/api/busetas', cookie, cuerpo) → { status, cuerpo, res }
  async function pedir(metodo, ruta, cookie, cuerpo) {
    const res = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    return { status: res.status, cuerpo: await res.json().catch(() => null), res };
  }

  // Envía un archivo tal cual (ej. una foto) y no sigue redirecciones, para
  // poder revisar a dónde manda el servidor.
  async function pedirArchivo(metodo, ruta, cookie, { contenido, tipo } = {}) {
    const res = await fetch(`${base}${ruta}`, {
      method: metodo,
      redirect: 'manual',
      headers: { ...(tipo && { 'Content-Type': tipo }), ...(cookie && { Cookie: cookie }) },
      body: contenido,
    });
    return { status: res.status, cuerpo: await res.json().catch(() => null), res };
  }

  return {
    base,
    pedir,
    pedirArchivo,
    cerrar: () => new Promise((resolve) => servidor.close(resolve)),
  };
}

// Extrae "nombre=valor" del Set-Cookie para reenviarlo en la siguiente petición.
export function cookieDe(res, nombre = 'sesion') {
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith(`${nombre}=`));
  return cookie?.split(';')[0] ?? null;
}

// Suma días a hoy en Bogotá → 'YYYY-MM-DD'.
export function enDias(n, hoy) {
  const d = new Date(`${hoy}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Almacén de archivos en memoria con la misma interfaz que el de Supabase.
export function crearAlmacenMemoria() {
  const archivos = new Map();
  return {
    archivos,
    async subir(bucket, ruta, contenido, tipo) {
      archivos.set(`${bucket}/${ruta}`, { contenido, tipo });
    },
    async borrar(bucket, ruta) {
      archivos.delete(`${bucket}/${ruta}`);
    },
    async urlFirmada(bucket, ruta, segundos) {
      return `https://almacen.prueba/${bucket}/${ruta}?expira=${segundos}`;
    },
  };
}

// Bytes mínimos que pasan por una imagen de cada tipo.
export const IMAGEN_JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
