// Calendario iCalendar (.ics) de coordinación: un evento por cada día de cada pedido
// (menos los rechazados) y las citas de entrega y devolución de uniformes.
// Puro: entra `Datos`, sale el texto del calendario.
import { cantidadDia, citaDevolucionTexto, citaEntregaTexto, esFechaISO, fechasCita, horarioUniformeTexto, lugarDia, primeraFechaDia, sumarDias } from './reglas';
import type { Datos } from './tipos';
import { confirmadosEnDia, vistaPedidos, type PedidoVista } from './vista';

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

interface Evento { uid: string; inicio: string; fin: string; titulo: string; lugar?: string; descripcion?: string; estado: 'CONFIRMED' | 'TENTATIVE'; categoria: string; /** Repetición (p. ej. FREQ=WEEKLY;UNTIL=…). */ rrule?: string }

function vevento(e: Evento, dtstamp: string): string[] {
  return [
    'BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${dtstamp}`, `DTSTART:${e.inicio}`, `DTEND:${e.fin}`, ...(e.rrule ? [`RRULE:${e.rrule}`] : []), `SUMMARY:${escapar(e.titulo)}`,
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
      '__ESTUDIANTES__',
      `Actividades: ${p.actividadesTexto || '—'}`,
      `Vestimenta: ${p.vestLabel}`,
      `Responsable en sitio: ${p.responsable}${p.responsableTelefono ? ` · ${p.responsableTelefono}` : ''}`,
      `Ver en la app: ${appUrl}/coordinacion?sel=${p.id}`,
    ].join('\n');
    for (const dia of p.dias) {
      const asisten = confirmadosEnDia(p, dia.fecha);
      const descripcionDia = descripcion.replace('__ESTUDIANTES__', `Estudiantes: ${asisten.length}/${cantidadDia(p, dia)} confirmados${p.multidia ? ' ese día' : ''}${asisten.length ? ` (${asisten.map((e) => e.nombre).join(', ')})` : ''}`);
      eventos.push({
        uid: `${p.id}-${dia.fecha}@protocolo-fcgt`, inicio: aUTC(dia.fecha, dia.inicio), fin: aUTC(dia.fecha, dia.fin),
        titulo: `${prefijo(p)}${p.evento}${p.multidia ? ` (día ${p.dias.indexOf(dia) + 1} de ${p.dias.length})` : ''}`,
        lugar: lugarDia(p, dia), descripcion: descripcionDia, estado: p.estado === 'Aprobado' ? 'CONFIRMED' : 'TENTATIVE', categoria: `Evento ${p.tipoLabel.toLowerCase()}`,
      });
    }
    const c = p.uniformeCita;
    if (c && p.estado === 'Aprobado') {
      const quienes = p.confirmados.map((e) => e.nombre).join(', ') || 'estudiantes confirmados';
      // Un periodo (p. ej. lunes a miércoles de 10:00 a 11:00) genera un evento por día, con la franja horaria (o 30 min si es hora puntual).
      for (const fecha of fechasCita(c.entregaFecha, c.entregaHasta)) eventos.push({ uid: `${p.id}-uniforme-entrega-${fecha}@protocolo-fcgt`, inicio: aUTC(fecha, c.entregaHora), fin: c.entregaHoraFin ? aUTC(fecha, c.entregaHoraFin) : aUTC(fecha, c.entregaHora, 30), titulo: `Entrega de uniformes · ${p.evento}`, lugar: c.lugar || undefined, descripcion: `Entrega del uniforme a: ${quienes}.${c.entregaHasta ? ` Periodo: ${citaEntregaTexto(c)}.` : ''}`, estado: 'CONFIRMED', categoria: 'Uniformes' });
      for (const fecha of fechasCita(c.devolucionFecha, c.devolucionHasta)) eventos.push({ uid: `${p.id}-uniforme-devolucion-${fecha}@protocolo-fcgt`, inicio: aUTC(fecha, c.devolucionHora), fin: c.devolucionHoraFin ? aUTC(fecha, c.devolucionHoraFin) : aUTC(fecha, c.devolucionHora, 30), titulo: `Devolución de uniformes · ${p.evento}`, lugar: c.lugar || undefined, descripcion: `Devolución (lavado) del uniforme de: ${quienes}.${c.devolucionHasta ? ` Periodo: ${citaDevolucionTexto(c)}.` : ''}`, estado: 'CONFIRMED', categoria: 'Uniformes' });
    }
  }
  // Horario fijo de uniformes: un evento semanal por franja durante el semestre (inicio + semanas).
  const a = d.ajustes;
  if (esFechaISO(a.inicioSemestre) && a.uniformeHorario.length) {
    const hasta = sumarDias(a.inicioSemestre, Math.max(1, a.semanas || 16) * 7 - 1);
    for (const f of a.uniformeHorario) {
      const primera = primeraFechaDia(a.inicioSemestre, f.dia);
      if (primera > hasta) continue;
      eventos.push({
        uid: `${a.periodo}-uniformes-${f.dia}@protocolo-fcgt`, inicio: aUTC(primera, f.inicio), fin: aUTC(primera, f.fin), rrule: `FREQ=WEEKLY;UNTIL=${hasta.replace(/-/g, '')}T235959Z`,
        titulo: `Uniformes · retiro y devolución${f.atiende ? ` (${f.atiende})` : ''}`, lugar: a.uniformeLugar || undefined,
        descripcion: `Horario fijo del periodo ${a.periodo}: ${horarioUniformeTexto(a.uniformeHorario)}.`, estado: 'CONFIRMED', categoria: 'Uniformes',
      });
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
