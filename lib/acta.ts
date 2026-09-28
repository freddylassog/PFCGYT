// Acta de compromiso en PDF: datos del evento, compromisos con cantidades y la
// aceptación electrónica del solicitante. Se genera al vuelo desde la base.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { fechaCorta, fechaLarga } from './reglas';
import type { PedidoVista } from './vista';

const AZUL = rgb(0.118, 0.302, 0.608);
const TEXTO = rgb(0.114, 0.122, 0.125);
const GRIS = rgb(0.45, 0.45, 0.47);
const ANCHO = 595.28, ALTO = 841.89, MARGEN = 48;

/** Hora de Ecuador (UTC-5) a partir de un ISO en UTC: 'martes 22 sep 2026 · 14:05'. */
export function fechaHoraEcuador(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const local = new Date(d.getTime() - 5 * 3600 * 1000);
  const fecha = local.toISOString().slice(0, 10);
  return `${fechaLarga(fecha)} · ${local.toISOString().slice(11, 16)}`;
}

/** pdf-lib usa fuentes estándar con codificación WinAnsi: se quitan los caracteres que no existen en ella. */
function limpiar(s: string): string {
  return s.replace(/[←-⇿☀-➿\uD800-\uDFFF]/g, '').replace(/[^\x00-\xFF–—‘’“”•…€]/g, '?');
}

class Escritor {
  private y = ALTO - MARGEN;
  private pagina!: PDFPage;
  private paginas = 0;
  constructor(private doc: PDFDocument, private normal: PDFFont, private negrita: PDFFont) { this.nueva(); }
  private nueva() { this.pagina = this.doc.addPage([ANCHO, ALTO]); this.paginas++; this.y = ALTO - MARGEN; }
  get pos() { return this.y; }
  espacio(n: number) { this.y -= n; }
  asegurar(alto: number) { if (this.y - alto < MARGEN + 30) this.nueva(); }
  imagen(png: Uint8Array | ArrayBuffer, anchoDeseado: number) {
    return this.doc.embedPng(png).then((img) => { const escala = anchoDeseado / img.width; this.pagina.drawImage(img, { x: MARGEN, y: this.y - img.height * escala, width: anchoDeseado, height: img.height * escala }); return img.height * escala; });
  }
  textoDerecha(texto: string, tamano: number, negrita = false, color = TEXTO, y = this.y) {
    const f = negrita ? this.negrita : this.normal; const t = limpiar(texto);
    this.pagina.drawText(t, { x: ANCHO - MARGEN - f.widthOfTextAtSize(t, tamano), y: y - tamano, size: tamano, font: f, color });
  }
  linea() { this.pagina.drawLine({ start: { x: MARGEN, y: this.y }, end: { x: ANCHO - MARGEN, y: this.y }, thickness: 0.8, color: AZUL }); this.y -= 10; }
  titulo(texto: string) { this.asegurar(26); this.y -= 6; this.pagina.drawText(limpiar(texto).toUpperCase(), { x: MARGEN, y: this.y - 11, size: 10.5, font: this.negrita, color: AZUL }); this.y -= 20; }
  /** Párrafo con ajuste de línea; `sangria` para listas y `etiqueta` para 'Etiqueta: valor'. */
  parrafo(texto: string, opts: { tamano?: number; negrita?: boolean; color?: ReturnType<typeof rgb>; sangria?: number; etiqueta?: string } = {}) {
    const tamano = opts.tamano ?? 10, f = opts.negrita ? this.negrita : this.normal, color = opts.color ?? TEXTO, sangria = opts.sangria ?? 0;
    const x0 = MARGEN + sangria, anchoUtil = ANCHO - MARGEN - x0, interlinea = tamano * 1.38;
    let xInicio = x0;
    if (opts.etiqueta) {
      this.asegurar(interlinea);
      const et = limpiar(opts.etiqueta);
      this.pagina.drawText(et, { x: x0, y: this.y - tamano, size: tamano, font: this.negrita, color: GRIS });
      xInicio = x0 + this.negrita.widthOfTextAtSize(et, tamano) + 4;
    }
    const palabras = limpiar(texto).split(/\s+/).filter(Boolean);
    let linea = '', x = xInicio, primera = true;
    const vaciar = () => { if (!linea && !primera) return; this.asegurar(interlinea); this.pagina.drawText(linea, { x, y: this.y - tamano, size: tamano, font: f, color }); this.y -= interlinea; linea = ''; x = x0; primera = false; };
    for (const palabra of palabras) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (f.widthOfTextAtSize(prueba, tamano) > anchoUtil - (x - x0) && linea) { vaciar(); linea = palabra; } else linea = prueba;
    }
    if (linea || primera) vaciar();
    this.y -= 2;
  }
  firma(x: number, ancho: number, lineas: string[]) {
    this.pagina.drawLine({ start: { x, y: this.y }, end: { x: x + ancho, y: this.y }, thickness: 0.8, color: TEXTO });
    lineas.forEach((l, i) => this.pagina.drawText(limpiar(l), { x, y: this.y - 12 - i * 11, size: i ? 8 : 9, font: i ? this.normal : this.negrita, color: i ? GRIS : TEXTO }));
  }
  pie(texto: string) {
    const t = limpiar(texto);
    this.doc.getPages().forEach((pg, i, arr) => {
      pg.drawText(t, { x: MARGEN, y: MARGEN - 18, size: 7.5, font: this.normal, color: GRIS });
      const n = `${i + 1} / ${arr.length}`;
      pg.drawText(n, { x: ANCHO - MARGEN - this.normal.widthOfTextAtSize(n, 7.5), y: MARGEN - 18, size: 7.5, font: this.normal, color: GRIS });
    });
  }
}

export async function generarActa(p: PedidoVista, periodo: string, ahora: Date = new Date()): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Acta de compromiso · ${p.codigo} · ${p.evento}`);
  doc.setAuthor('Coordinación de Protocolo · FCGT · Universidad UTE');
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Escritor(doc, normal, negrita);

  // Cabecera: logo a la izquierda, título a la derecha
  let altoLogo = 0;
  try { altoLogo = await w.imagen(await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'assets', 'logo-fcgt.png')), 150); } catch { /* sin logo */ }
  w.textoDerecha('ACTA DE COMPROMISO', 16, true, AZUL, w.pos - 4);
  w.textoDerecha(`Apoyo protocolario · Pedido ${p.codigo}`, 10, false, TEXTO, w.pos - 26);
  w.textoDerecha(`Coordinación de Protocolo · FCGT · Universidad UTE · Periodo ${periodo}`, 8.5, false, GRIS, w.pos - 41);
  w.espacio(Math.max(altoLogo, 56) + 10);
  w.linea();

  w.titulo('1. Evento');
  w.parrafo(p.evento, { etiqueta: 'Evento:', negrita: true });
  w.parrafo(`${p.institucion} · ${p.tipoLabel}${p.tipo === 'externo' ? ` · ${p.convLabel}` : ''}`, { etiqueta: 'Organiza:' });
  if (p.multidia) {
    w.parrafo(`${p.dias.length} días · ${p.horas} h de protocolo en total`, { etiqueta: 'Fechas:' });
    p.dias.forEach((d, i) => w.parrafo(`Día ${i + 1}: ${fechaLarga(d.fecha)} · ${d.inicio}–${d.fin}`, { sangria: 14 }));
  } else {
    w.parrafo(`${p.fechaLarga} · ${p.horarioTexto} · ${p.horas} h de protocolo`, { etiqueta: 'Fecha y horario:' });
  }
  w.parrafo(`${p.lugar}${p.lejos ? ' · fuera del Distrito Metropolitano de Quito / aeropuerto' : ''}`, { etiqueta: 'Lugar:' });
  w.parrafo(`${p.cantidad} · ${p.actividadesTexto || '—'}`, { etiqueta: 'Estudiantes y actividades:' });
  w.parrafo(`${p.vestLabel}. ${p.vestNotaEst}`, { etiqueta: 'Vestimenta:' });

  w.titulo('2. Solicitante y responsable en sitio');
  w.parrafo(`${p.nombre}, ${p.cargo} · ${p.correoSolicitante || 'sin correo'}`, { etiqueta: 'Solicita:' });
  w.parrafo(`${p.responsable}${p.responsableTelefono ? ` · ${p.responsableTelefono}` : ''} (recibe y acompaña a los estudiantes; contacto de la coordinación durante el evento)`, { etiqueta: 'Responsable en sitio:' });

  w.titulo('3. Compromisos de la organización');
  w.parrafo('Según las reglas de la Facultad: alimentación por cada 4 horas de participación; transporte de ida y regreso si el lugar está fuera del Distrito Metropolitano de Quito o es el aeropuerto, y de regreso a casa si el evento termina después de las 18:00; los estudiantes realizan únicamente las actividades marcadas. Con los datos de este pedido, la organización se compromete a:', { color: GRIS, tamano: 9 });
  const letras = 'abcdefgh';
  p.compromisosLista.forEach((c, i) => w.parrafo(`${c.titulo}${c.aplica ? '' : ' (no aplica)'}: ${c.texto}`, { sangria: 14, etiqueta: `${letras[i]})` }));
  w.parrafo('Trato respetuoso y condiciones seguras para los estudiantes durante toda su participación. Cualquier novedad se comunica de inmediato a la Coordinación de Protocolo.', { sangria: 14, etiqueta: `${letras[p.compromisosLista.length]})` });

  w.titulo('4. Aceptación');
  w.parrafo(`Aceptado electrónicamente en la aplicación de Protocolo de eventos por ${p.nombre} (${p.cargo}, ${p.institucion}), con el correo ${p.correoSolicitante || '—'}, el ${fechaHoraEcuador(p.createdAt)} (hora de Ecuador), al registrar el pedido ${p.codigo}.`);
  w.parrafo('Esta aceptación electrónica es el respaldo del compromiso ante la Facultad. La firma manuscrita es opcional: si la organización lo requiere, puede imprimir esta acta, firmarla y entregarla a la coordinación.', { color: GRIS, tamano: 9 });
  w.espacio(46);
  w.asegurar(60);
  const anchoFirma = (ANCHO - 2 * MARGEN - 40) / 2;
  w.firma(MARGEN, anchoFirma, ['Responsable de la organización', `${p.nombre} · ${p.cargo}`, p.institucion]);
  w.firma(MARGEN + anchoFirma + 40, anchoFirma, ['Coordinación de Protocolo', 'Facultad de Ciencias Gastronómicas y Turismo', 'Universidad UTE']);
  w.espacio(50);
  w.pie(`Acta generada el ${fechaCorta(ahora.toISOString().slice(0, 10))} · Protocolo de eventos · FCGT · Universidad UTE · ${p.codigo}`);
  return doc.save();
}
