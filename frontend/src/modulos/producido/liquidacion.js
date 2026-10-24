// Líneas de la liquidación mensual de la cooperativa, en el orden del documento.

export const OPERATIVOS = [
  ['administracion', 'Administración'],
  ['polizas', 'Pólizas'],
  ['fondoReposicion', 'Fondo de reposición'],
  ['salidas', 'Salidas'],
  ['combustibles', 'Combustibles'],
  ['peajes', 'Peajes'],
  ['prestamos', 'Préstamos'],
];

export const NOMINA = [
  ['salarioConductor', 'Salario conductor'],
  ['prestacionesConductor', 'Prestaciones conductor'],
  ['seguridadSocialConductor', 'Seguridad social conductor'],
  ['salarioRelevo', 'Salario relevo'],
  ['prestacionesRelevo', 'Prestaciones relevo'],
  ['seguridadSocialRelevo', 'Seguridad social relevo'],
  ['vacacionesRelevo', 'Vacaciones relevo'],
];

// Neto que da la cuenta: total bruto − todos los descuentos.
export const netoCalculado = (l) =>
  (l.totalBruto ?? 0) - [...OPERATIVOS, ...NOMINA].reduce((t, [clave]) => t + (l[clave] ?? 0), 0);
