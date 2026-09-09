import 'server-only';
import ExcelJS from 'exceljs';
import { DEVOLUCION, DIAS_CLASE, infoUniforme, semLabel } from './reglas';
import { CLAVES_HORA, normalizarClave, pad2, parsearCsv, type Fila } from './importar';
export { parseDocentes, parseEstudiantes, parseHorarios, parseDia, parseGenero, parseHora, parseSemestre } from './importar';
export type { Fila } from './importar';
import type { Datos, Semestre } from './tipos';
import { matrizSemestres, resumenHoras, vistaPedidos } from './vista';

// ---------------------------------------------------------------- lectura

function celdaATexto(v: ExcelJS.CellValue, esHora: boolean): string {
  if (v == null) return '';
  if (v instanceof Date) {
    if (esHora || v.getUTCFullYear() < 1905) return `${pad2(v.getUTCHours())}:${pad2(v.getUTCMinutes())}`;
    return `${v.getUTCFullYear()}-${pad2(v.getUTCMonth() + 1)}-${pad2(v.getUTCDate())}`;
  }
  if (typeof v === 'number') {
    if (esHora && v >= 0 && v < 1) {
      const m = Math.round(v * 24 * 60);
      return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
    }
    return String(v);
  }
  if (typeof v === 'object') {
    const o = v as { text?: unknown; result?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (o.richText) return o.richText.map((r) => r.text).join('');
    if (o.text != null) return typeof o.text === 'object' ? celdaATexto(o.text as ExcelJS.CellValue, esHora) : String(o.text);
    if (o.result != null) return celdaATexto(o.result as ExcelJS.CellValue, esHora);
    return '';
  }
  return String(v).trim();
}

/** Lee la primera hoja (o el CSV) y devuelve filas como {columna normalizada: texto}. */
export async function leerTabla(buffer: Buffer, nombreArchivo: string): Promise<Fila[]> {
  let matriz: string[][];
  if (/\.csv$/i.test(nombreArchivo)) {
    matriz = parsearCsv(buffer.toString('utf8'));
  } else {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    matriz = [];
    let encabezados: string[] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const valores = row.values as ExcelJS.CellValue[]; // índice 1-based
      const celdas: string[] = [];
      for (let c = 1; c < valores.length; c++) {
        const enc = encabezados[c - 1] ?? '';
        celdas.push(celdaATexto(valores[c], CLAVES_HORA.includes(enc)));
      }
      if (!encabezados.length && celdas.some((x) => x.trim())) encabezados = celdas.map(normalizarClave);
      matriz.push(celdas);
    });
  }
  if (!matriz.length) return [];
  const enc = matriz[0].map(normalizarClave);
  return matriz.slice(1).filter((f) => f.some((c) => c && c.trim())).map((f) => {
    const obj: Fila = {};
    enc.forEach((k, i) => { if (k) obj[k] = (f[i] ?? '').toString().trim(); });
    return obj;
  });
}

// ---------------------------------------------------------------- escritura

function hoja(wb: ExcelJS.Workbook, nombre: string, filas: (string | number)[][], anchos: number[]) {
  const ws = wb.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = anchos.map((w) => ({ width: w }));
  filas.forEach((f) => ws.addRow(f));
  ws.getRow(1).font = { bold: true };
  return ws;
}

function devolucionTexto(d: Datos, studentId: string, enUso: boolean): string {
  const dev = d.devoluciones.find((x) => x.studentId === studentId);
  return dev ? DEVOLUCION[dev.estado].label : enUso ? 'En uso' : '—';
}

/** Reporte del semestre: hojas Eventos, Horas, Estudiantes y Novedades. */
export async function generarReporte(d: Datos): Promise<Buffer> {
  const pedidos = vistaPedidos(d);
  const matriz = matrizSemestres(d, pedidos);
  const horas = resumenHoras(d, pedidos);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Protocolo FCGT';

  const ev: (string | number)[][] = [['Código', 'Evento', 'Institución', 'Tipo', 'Convenio', 'Estado', 'Fecha', 'Inicio', 'Fin', 'Horas', 'Estudiantes solicitados', 'Confirmados', 'Vestimenta', 'Alimentación', 'Transporte', 'Lugar', 'Responsable', 'Fecha pedido', 'Evidencia', 'Estudiantes confirmados', 'Novedades']];
  pedidos.forEach((e) => ev.push([e.codigo, e.evento, e.institucion, e.tipoLabel, e.tipo === 'externo' ? (e.convenio === 'si' ? 'Vigente' : 'Sin convenio') : 'UTE', e.estado, e.fecha, e.inicio, e.fin, e.horas, e.cantidad, e.confirmadosN, e.vestLabel, e.pasa4h ? 'Sí' : 'No', e.transporte ? 'Sí' : 'No', e.lugar, e.responsable, e.createdAt.slice(0, 10), e.evidenciaTexto, e.confirmados.map((s) => s.nombre).join('; '), e.novedadesTexto]));
  hoja(wb, 'Eventos', ev, [14, 34, 28, 9, 13, 10, 11, 7, 7, 7, 10, 11, 24, 12, 11, 32, 26, 11, 28, 40, 40]);

  hoja(wb, 'Horas', [['Concepto', 'Horas'], ['Horas asignadas por semana', horas.horasSemana], [`Horas del semestre (${horas.semanas} semanas)`, horas.total], ['Horas registradas en eventos aprobados', horas.usadas], ['Horas disponibles', horas.restantes]], [40, 10]);

  const est: (string | number)[][] = [['Semestre', 'Estudiante', 'Correo', 'Eventos', 'Horas', 'Eventos (detalle)', 'Cumple mínimo 2', 'Novedades', 'Uniforme', 'Prendas entregadas', 'Faltan', 'Devolución']];
  matriz.forEach((m) => m.filas.forEach((r) => {
    const u = infoUniforme(r.genero, d.prendas.filter((p) => p.studentId === r.id).map((p) => p.item));
    est.push([m.semestre, r.nombre, r.correo, r.eventosN, r.horas, r.detalle, r.cumple ? 'Sí' : 'No', r.novedadesN, u.estado, u.tiene.join('; '), u.faltan.join('; '), devolucionTexto(d, r.id, u.n > 0)]);
  }));
  hoja(wb, 'Estudiantes', est, [9, 26, 30, 8, 7, 50, 14, 10, 14, 40, 30, 22]);

  const nov: (string | number)[][] = [['Fecha', 'Evento', 'Código', 'Estudiante', 'Semestre', 'Tipo de novedad', 'Detalle', 'Reportado a decanato']];
  d.novedades.forEach((n) => {
    const e = pedidos.find((x) => x.id === n.requestId);
    const p = d.estudiantes.find((x) => x.id === n.studentId);
    nov.push([n.fecha, e?.evento ?? '', e?.codigo ?? '', p?.nombre ?? '', p?.semestre ?? '', n.tipo, n.nota, n.reportadoAt ?? 'Pendiente']);
  });
  hoja(wb, 'Novedades', nov, [11, 34, 14, 26, 9, 24, 30, 20]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Matriz de un semestre (para adjuntar al correo del docente). */
export async function generarMatriz(d: Datos, semestre: Semestre): Promise<Buffer> {
  const m = matrizSemestres(d).find((x) => x.semestre === semestre)!;
  const wb = new ExcelJS.Workbook();
  const filas: (string | number)[][] = [['Estudiante', 'Correo', 'Eventos', 'Horas', 'Eventos (detalle)', 'Cumple mínimo 2', 'Novedades', 'Estado']];
  m.filas.forEach((r) => filas.push([r.nombre, r.correo, r.eventosN, r.horas, r.detalle, r.cumple ? 'Sí' : 'No', r.novedadesN, r.estado]));
  const ws = hoja(wb, `${m.semestre}.º semestre`, filas, [26, 30, 8, 7, 50, 14, 10, 20]);
  ws.insertRow(1, [`Matriz de protocolo · ${semLabel(m.semestre)} · periodo ${d.ajustes.periodo} · mínimo 2 eventos por estudiante`]);
  ws.getRow(1).font = { bold: true, size: 13 };
  ws.getRow(2).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export { DIAS_CLASE };
