import { kilometros } from '../../compartido/utilidades/formato.js';

// Trabajos que suelen hacerse junto con otro: al registrar el primero se
// ofrecen como casillas ("también cambié…") para no registrarlos uno por uno.
export const ACOMPANANTES = {
  aceite: ['filtro_aceite', 'filtro_aire', 'filtro_combustible'],
};

// Suma meses a 'YYYY-MM-DD' sin pasarse del fin de mes (31 ene + 1 mes → 28 feb).
export function sumarMeses(iso, meses) {
  const [a, m, d] = iso.split('-').map(Number);
  const destino = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
  destino.setUTCDate(Math.min(d, ultimoDia));
  return destino.toISOString().slice(0, 10);
}

// Próximo cambio propuesto con el intervalo del tipo (editable antes de guardar).
export function proponerProximo(tipo, fecha, kilometraje) {
  return {
    proximoKm: tipo?.intervaloKm && kilometraje != null ? kilometraje + tipo.intervaloKm : null,
    proximaFecha: tipo?.intervaloMeses && fecha ? sumarMeses(fecha, tipo.intervaloMeses) : '',
  };
}

// Texto de lo que falta (o de lo que ya se pasó) según el estado del backend.
// Si ya venció, solo se dice por qué (km o fecha), no lo que aún "falta" del otro.
export function textoEstado({ estado, kmRestantes, dias }) {
  if (estado === 'sin_registro') return 'Sin registro';
  if (estado === 'vencido') {
    if (kmRestantes !== null && kmRestantes >= 0) kmRestantes = null;
    if (dias !== null && dias >= 0) dias = null;
  }

  const partes = [];
  if (kmRestantes !== null) {
    if (kmRestantes < 0) partes.push(`pasado por ${kilometros(-kmRestantes)}`);
    else if (kmRestantes === 0) partes.push('toca ya');
    else partes.push(`faltan ${kilometros(kmRestantes)}`);
  }
  if (dias !== null) {
    if (dias < 0) partes.push(dias === -1 ? 'venció ayer' : `venció hace ${-dias} días`);
    else if (dias === 0) partes.push('toca hoy');
    else partes.push(dias === 1 ? 'mañana' : `en ${dias} días`);
  }

  const titulo = { vencido: 'Vencido', pronto: 'Pronto', al_dia: 'Al día' }[estado];
  return partes.length ? `${titulo}: ${partes.join(' o ')}` : `${titulo}: sin próximo programado`;
}

export const requiereAtencion = (e) => e.estado === 'vencido' || e.estado === 'pronto';
