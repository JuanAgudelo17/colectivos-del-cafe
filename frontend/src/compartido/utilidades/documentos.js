// Documentos con vencimiento de cada buseta, en el orden en que se muestran.
// clave = la de `buseta.documentos` en la API; campo = la fecha en el formulario.
export const DOCUMENTOS = [
  { clave: 'soat', nombre: 'SOAT', campo: 'fechaSoat' },
  { clave: 'tecnomecanica', nombre: 'Tecnomecánica', campo: 'fechaTecnomecanica' },
  { clave: 'tarjetaOperacion', nombre: 'Tarjeta de operación', campo: 'fechaTarjetaOperacion' },
  { clave: 'polizaRcc', nombre: 'Póliza contractual (RCC)', campo: 'fechaPolizaRcc' },
  { clave: 'polizaRce', nombre: 'Póliza extracontractual (RCE)', campo: 'fechaPolizaRce' },
  { clave: 'extintor', nombre: 'Extintor', campo: 'fechaExtintor' },
];

export const requiereAtencion = (documento) => documento.estado === 'vencido' || documento.estado === 'por_vencer';
