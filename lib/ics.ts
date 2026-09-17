// Calendario iCalendar (.ics) de coordinación: un evento por cada día de cada pedido
// (menos los rechazados) y las citas de entrega y devolución de uniformes.
// Puro: entra `Datos`, sale el texto del calendario.
import type { Datos } from './tipos';
import { vistaPedidos, type PedidoVista } from './vista';

/** Ecuador continental: UTC-5 todo el año (sin horario de verano). */
const DESFASE_HORAS = 5;

/** 'YYYY-MM-DD' + 'HH:MM' (hora de Ecuador) → 'YYYYMMDDTHHMMSSZ' en UTC. */
export function aUTC(fecha: string, hora: string, minutosExtra = 0): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, h + DESFASE_HORAS, mi + minutosExtra)).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** Escapa un valor de texto según RFC 5545. */
export function escapar(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Corta las líneas a 75 octetos (las continuaciones empiezan con un espacio). */
export function plegar(linea: string): string {
  const enc = new TextEncoder();
  const lineas: string[] = [];
  let actual = '', bytes = 0;
  for (const ch of linea) {
    const b = enc.encode(ch).length;
    if (bytes + b > 75) { lineas.push(actual); actual = ' ' + ch; bytes = 1 + b; } else { actual += ch; bytes += b; }
  }
  lineas.push(actual);
  return lineas.join('\r\n');
}

interface Evento { uid: string; inicio: string; fin: string; titulo: string; lugar?: string; descripcion?: string; estado: 'CONFIRMED' | 'TENTATIVE'; categoria: string }

function vevento(e: Evento, dtstamp: string): string[] {
  return [
    'BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${dtstamp}`, `DTSTART:${e.inicio}`, `DTEND:${e.fin}`, `SUMMARY:${escapar(e.titulo)}`,
    ...(e.lugar ? [`LOCATION:${escapar(e.lugar)}`] : []),
    ...(e.descripcion ? [`DESCRIPTION:${escapar(e.descripcion)}`] : []),
    `STATUS:${e.estado}`, `CATEGORIES:${escapar(e.categoria)}`, 'END:VEVENT',
  ];
}

function prefijo(p: PedidoVista): string {
  if (p.finalizado) return '[Finalizado] ';
  if (p.estado === 'Pendiente') return '[Por aprobar] ';
  if (p.estado === 'Ajustes') return '[En ajustes] ';
  return '';
}

export function eventosCalendario(d: Datos, appUrl: string): Evento[] {
  const eventos: Evento[] = [];
  for (const p of vistaPedidos(d)) {
    if (p.estado === 'Rechazado') continue;
    const descripcion = [
      `${p.codigo} · ${p.tipoLabel} · ${p.institucion}`,
      `Estado: ${p.estadoLabel}`,
      `Solicita: ${p.nombre}, ${p.cargo}`,
      `Estudiantes: ${p.confirmadosN}/${p.cantidad} confirmados${p.confirmadosN ? ` (${p.confirmados.map((e) => e.nombre).join(', ')})` : ''}`,
      `Actividades: ${p.actividadesTexto || '—'}`,
      `Vestimenta: ${p.vestLabel}`,
      `Responsable en sitio: ${p.responsable}${p.responsableTelefono ? ` · ${p.responsableTelefono}` : ''}`,
      `Ver en la app: ${appUrl}/coordinacion?sel=${p.id}`,
    ].join('\n');
    for (const dia of p.dias) {
      eventos.push({
        uid: `${p.id}-${dia.fecha}@protocolo-fcgt`, inicio: aUTC(dia.fecha, dia.inicio), fin: aUTC(dia.fecha, dia.fin),
        titulo: `${prefijo(p)}${p.evento}${p.multidia ? ` (día ${p.dias.indexOf(dia) + 1} de ${p.dias.length})` : ''}`,
        lugar: p.lugar, descripcion, estado: p.estado === 'Aprobado' ? 'CONFIRMED' : 'TENTATIVE', categoria: `Evento ${p.tipoLabel.toLowerCase()}`,
      });
    }
    const c = p.uniformeCita;
    if (c && p.estado === 'Aprobado') {
      const quienes = p.confirmados.map((e) => e.nombre).join(', ') || 'estudiantes confirmados';
      if (c.entregaFecha) eventos.push({ uid: `${p.id}-uniforme-entrega@protocolo-fcgt`, inicio: aUTC(c.entregaFecha, c.entregaHora), fin: aUTC(c.entregaFecha, c.entregaHora, 30), titulo: `Entrega de uniformes · ${p.evento}`, lugar: c.lugar || undefined, descripcion: `Entrega del uniforme a: ${quienes}.`, estado: 'CONFIRMED', categoria: 'Uniformes' });
      if (c.devolucionFecha) eventos.push({ uid: `${p.id}-uniforme-devolucion@protocolo-fcgt`, inicio: aUTC(c.devolucionFecha, c.devolucionHora), fin: aUTC(c.devolucionFecha, c.devolucionHora, 30), titulo: `Devolución de uniformes · ${p.evento}`, lugar: c.lugar || undefined, descripcion: `Devolución (lavado) del uniforme de: ${quienes}.`, estado: 'CONFIRMED', categoria: 'Uniformes' });
    }
  }
  return eventos;
}

export function calendarioICS(d: Datos, appUrl: string, ahora: Date = new Date()): string {
  const dtstamp = ahora.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lineas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FCGT UTE//Protocolo de eventos//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:Protocolo FCGT ${d.ajustes.periodo}`, 'X-WR-TIMEZONE:America/Guayaquil', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    ...eventosCalendario(d, appUrl).flatMap((e) => vevento(e, dtstamp)),
    'END:VCALENDAR',
  ];
  return lineas.map(plegar).join('\r\n') + '\r\n';
}
