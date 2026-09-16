'use server';
import type { JSONValue } from 'postgres';
import { db } from '@/lib/db';
import { ajustesActuales, mapPedido, pedidosDelPeriodo } from '@/lib/datos';
import { evidenciaExiste, prepararSubida } from '@/lib/storage';
import { notificarNuevoPedido } from '@/lib/notificar';
import {
  ACTIVIDADES, codigoPedido, cruceEventos, esFechaISO, esHora, faltasPedido, fechaLargaDias, hoyISO, normalizarCorreo, ordenarDias, type FormPedido,
} from '@/lib/reglas';
import type { RepartoActividad } from '@/lib/tipos';
import type { DiaEvento, Resultado } from '@/lib/tipos';

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

export interface CruceInfo { evento: string; codigo: string; estado: string; fecha: string; inicio: string; fin: string }

function diasValidos(dias: DiaEvento[]): DiaEvento[] {
  return ordenarDias((dias || []).filter((d) => esFechaISO(d.fecha) && esHora(d.inicio) && esHora(d.fin)));
}

export async function verificarCruce(dias: DiaEvento[], excluirId?: string): Promise<CruceInfo | null> {
  const propios = diasValidos(dias);
  if (!propios.length) return null;
  const pedidos = await pedidosDelPeriodo();
  const c = cruceEventos({ dias: propios }, pedidos, excluirId);
  return c ? { evento: c.pedido.evento, codigo: c.pedido.codigo, estado: c.pedido.estado, fecha: c.dia.fecha, inicio: c.dia.inicio, fin: c.dia.fin } : null;
}

export interface PedidoCreado { id: string; codigo: string; evento: string; fechaLarga: string; horario: string }

export async function crearPedido(f: FormPedido): Promise<Resultado<PedidoCreado>> {
  const hoy = hoyISO();
  const pedidos = await pedidosDelPeriodo();
  const dias = ordenarDias(f.dias || []);
  const cruce = cruceEventos({ dias }, pedidos);
  const faltas = faltasPedido({ ...f, dias }, hoy, cruce ? { evento: cruce.pedido.evento } : null).flat();
  if (faltas.length) return { ok: false, error: 'Falta: ' + faltas.join(', ') };
  const primero = dias[0];
  const reparto: RepartoActividad[] = (f.reparto || []).filter((x) => ACTIVIDADES.includes(x.actividad)).map((x) => ({ actividad: x.actividad, cantidad: Math.round(Number(x.cantidad)) }));
  const actividades = reparto.map((x) => x.actividad);
  if (!actividades.length) return { ok: false, error: 'Elige al menos una actividad.' };
  if (!(await evidenciaExiste(f.evidenciaPath))) return { ok: false, error: 'La evidencia no terminó de subirse. Adjúntala de nuevo.' };

  const sql = db();
  const { periodo } = await ajustesActuales();
  for (let intento = 0; intento < 3; intento++) {
    try {
      const [fila] = await sql`
        insert into requests (periodo, numero, codigo, nombre, cargo, institucion, correo_solicitante, tipo, convenio,
          evento, fecha, inicio, fin, dias, lugar, lejos, responsable, responsable_telefono, cantidad, actividades, reparto, vestimenta, evidencia_path, evidencia_nombre)
        select ${periodo}, n, ${'SOL-' + periodo.slice(0, 4) + '-'} || lpad(n::text, 3, '0'),
          ${f.nombre.trim()}, ${f.cargo.trim()}, ${f.institucion.trim()}, ${normalizarCorreo(f.correoSolicitante)},
          ${f.tipo}, ${f.tipo === 'externo' ? f.convenio : 'si'}, ${f.evento.trim()}, ${primero.fecha}, ${primero.inicio}, ${primero.fin}, ${sql.json(dias as unknown as JSONValue)},
          ${f.lugar.trim()}, ${!!f.lejos}, ${f.responsable.trim()}, ${f.responsableTelefono.trim()}, ${Math.round(f.cantidad)}, ${actividades}, ${sql.json(reparto as unknown as JSONValue)}, ${f.vestimenta},
          ${f.evidenciaPath}, ${f.evidenciaNombre.slice(0, 200)}
        from (select coalesce(max(numero), 0) + 1 as n from requests where periodo = ${periodo}) s
        returning *`;
      const p = mapPedido(fila);
      await notificarNuevoPedido(p, await ajustesActuales());
      return { ok: true, datos: { id: p.id, codigo: p.codigo, evento: p.evento, fechaLarga: fechaLargaDias(p.dias), horario: p.dias.length > 1 ? `${p.dias.length} días` : `${p.inicio}–${p.fin}` } };
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
