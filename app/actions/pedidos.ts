'use server';
import { db } from '@/lib/db';
import { ajustesActuales, mapPedido, pedidosDelPeriodo } from '@/lib/datos';
import { evidenciaExiste, prepararSubida } from '@/lib/storage';
import {
  ACTIVIDADES, codigoPedido, cruceEventos, esHora, faltasPedido, hoyISO, normalizarCorreo, type FormPedido,
} from '@/lib/reglas';
import { fechaLarga } from '@/lib/reglas';
import type { Resultado } from '@/lib/tipos';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'application/pdf'];
const MAX_BYTES = 15 * 1024 * 1024;

export async function prepararEvidencia(nombre: string, tipo: string, tamano: number): Promise<Resultado<{ path: string; url: string }>> {
  if (!nombre) return { ok: false, error: 'Archivo sin nombre.' };
  if (tamano > MAX_BYTES) return { ok: false, error: 'El archivo supera 15 MB.' };
  const esPdf = /\.pdf$/i.test(nombre);
  if (!TIPOS_PERMITIDOS.includes(tipo) && !esPdf && !tipo.startsWith('image/')) return { ok: false, error: 'Solo se aceptan imágenes o PDF.' };
  try {
    const { periodo } = await ajustesActuales();
    const subida = await prepararSubida(periodo, nombre);
    return { ok: true, datos: subida };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface CruceInfo { evento: string; inicio: string; fin: string; estado: string; codigo: string }

export async function verificarCruce(fecha: string, inicio: string, fin: string): Promise<CruceInfo | null> {
  if (!fecha || !esHora(inicio) || !esHora(fin)) return null;
  const pedidos = await pedidosDelPeriodo();
  const c = cruceEventos({ fecha, inicio, fin }, pedidos);
  return c ? { evento: c.evento, inicio: c.inicio, fin: c.fin, estado: c.estado, codigo: c.codigo } : null;
}

export interface PedidoCreado { id: string; codigo: string; evento: string; fechaLarga: string; inicio: string; fin: string }

export async function crearPedido(f: FormPedido): Promise<Resultado<PedidoCreado>> {
  const hoy = hoyISO();
  const pedidos = await pedidosDelPeriodo();
  const cruce = cruceEventos(f, pedidos);
  const faltas = faltasPedido(f, hoy, cruce).flat();
  if (faltas.length) return { ok: false, error: 'Falta: ' + faltas.join(', ') };
  const actividades = f.actividades.filter((a) => ACTIVIDADES.includes(a));
  if (!actividades.length) return { ok: false, error: 'Elige al menos una actividad.' };
  if (!(await evidenciaExiste(f.evidenciaPath))) return { ok: false, error: 'La evidencia no terminó de subirse. Adjúntala de nuevo.' };

  const sql = db();
  const { periodo } = await ajustesActuales();
  for (let intento = 0; intento < 3; intento++) {
    try {
      const [fila] = await sql`
        insert into requests (periodo, numero, codigo, nombre, cargo, institucion, correo_solicitante, tipo, convenio,
          evento, fecha, inicio, fin, lugar, lejos, responsable, cantidad, actividades, vestimenta, evidencia_path, evidencia_nombre)
        select ${periodo}, n, ${'SOL-' + periodo.slice(0, 4) + '-'} || lpad(n::text, 3, '0'),
          ${f.nombre.trim()}, ${f.cargo.trim()}, ${f.institucion.trim()}, ${normalizarCorreo(f.correoSolicitante)},
          ${f.tipo}, ${f.tipo === 'externo' ? f.convenio : 'si'}, ${f.evento.trim()}, ${f.fecha}, ${f.inicio}, ${f.fin},
          ${f.lugar.trim()}, ${!!f.lejos}, ${f.responsable.trim()}, ${Math.round(f.cantidad)}, ${actividades}, ${f.vestimenta},
          ${f.evidenciaPath}, ${f.evidenciaNombre.slice(0, 200)}
        from (select coalesce(max(numero), 0) + 1 as n from requests where periodo = ${periodo}) s
        returning *`;
      const p = mapPedido(fila);
      return { ok: true, datos: { id: p.id, codigo: p.codigo, evento: p.evento, fechaLarga: fechaLarga(p.fecha), inicio: p.inicio, fin: p.fin } };
    } catch (e) {
      const msg = (e as Error).message || '';
      if (!/duplicate|unique/i.test(msg) || intento === 2) return { ok: false, error: 'No se pudo registrar el pedido: ' + msg };
    }
  }
  return { ok: false, error: 'No se pudo registrar el pedido.' };
}

export async function codigoSiguiente(): Promise<string> {
  const sql = db();
  const { periodo } = await ajustesActuales();
  const [r] = await sql`select coalesce(max(numero), 0) + 1 as n from requests where periodo = ${periodo}`;
  return codigoPedido(periodo, Number(r.n));
}
