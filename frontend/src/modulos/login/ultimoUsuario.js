// Recuerda en este dispositivo quién entró la última vez (usuario y primer nombre,
// nunca la contraseña) para saludarlo y que solo escriba la contraseña.
// El almacenamiento puede no estar disponible (modo privado): sin él, se pide el usuario.
const CLAVE = 'ultimo-usuario';

export function leerUltimoUsuario() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    return guardado?.usuario ? guardado : null;
  } catch {
    return null;
  }
}

export function guardarUltimoUsuario({ usuario, nombre }) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ usuario, nombre: nombre.split(' ')[0] }));
  } catch {
    // Sin almacenamiento no pasa nada: la próxima vez se pide el usuario.
  }
}

export function olvidarUltimoUsuario() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Ídem.
  }
}
