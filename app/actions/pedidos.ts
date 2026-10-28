'use server';
import type { JSONValue } from 'postgres';
import { db } from '@/lib/db';
import { ajustesActuales, mapPedido, pedidosDelPeriodo } from '@/lib/datos';
import { evidenciaExiste, prepararSubida } from '@/lib/storage';
import { notificarNuevoPedido } from '@/lib/notificar';
import { appUrl } from '@/lib/app-url';
import { candidatosPorNombre } from '@/lib/importar';
import { tokenActa } from '@/lib/sesion';
import {
  ACTIVIDADES, anticipacionVigente, codigoPedido, cruceEventos, unirRepartos, esFechaISO, esHora, faltasPedido, fechaLargaDias, hoyISO, normalizarCorreo, ordenarDias, solicitanteInterno, type FormPedido,
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

function limpiarReparto(r: RepartoActividad[] | undefined): RepartoActividad[] {
  return (r || []).filter((x) => ACTIVIDADES.includes(x.actividad)).map((x) => ({ actividad: x.actividad, cantidad: Math.round(Number(x.cantidad)) }));
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

export interface PedidoCreado { id: string; codigo: string; evento: string; fechaLarga: string; horario: string; actaUrl: string }

/** ¿Es un solicitante interno frecuente? Por correo (coincidencia exacta) o, si no hay correo, por nombre y apellido
 *  (una sola coincidencia). Devuelve sus datos para prellenar el formulario. */
export async function reconocerSolicitante(correo: string, nombre = ''): Promise<{ interno: boolean; nombre: string; cargo: string; correo: string; sinAnticipacion: boolean }> {
  const a = await ajustesActuales();
  const nadie = { interno: false, nombre: '', cargo: '', correo: '', sinAnticipacion: false };
  let x = solicitanteInterno(a.solicitantesInternos, String(correo || ''));
  if (!x && String(nombre || '').trim()) {
    const candidatos = candidatosPorNombre(a.solicitantesInternos, String(nombre).slice(0, 120));
    if (candidatos.length === 1) x = candidatos[0];
  }
  return x ? { interno: true, nombre: x.nombre, cargo: x.cargo, correo: x.correo, sinAnticipacion: !!x.sinAnticipacion } : nadie;
}

export async function crearPedido(f: FormPedido): Promise<Resultado<PedidoCreado>> {
  const hoy = hoyISO();
  const ajustes = await ajustesActuales();
  // Solicitante interno frecuente: evento interno, sin adjunto (este formulario es el pedido); si está marcado, sin anticipación mínima.
  const interno = solicitanteInterno(ajustes.solicitantesInternos, f.correoSolicitante);
  if (interno) f = { ...f, tipo: 'interno', convenio: 'si' };
  const horasMin = interno?.sinAnticipacion ? 0 : anticipacionVigente(ajustes, hoy);
  const pedidos = await pedidosDelPeriodo();
  const dias = ordenarDias(f.dias || []).map((d) => ({ fecha: d.fecha, inicio: d.inicio, fin: d.fin, lugar: (d.lugar ?? '').trim().slice(0, 300), lejos: !!d.lejos, ...(!f.mismosEstudiantes && Number(d.cantidad) > 0 ? { cantidad: Math.round(Number(d.cantidad)) } : {}), ...(d.reparto?.length ? { reparto: limpiarReparto(d.reparto) } : {}) }));
  const lugar = dias[0]?.lugar || f.lugar.trim();
  const lejos = dias.some((d) => d.lejos);
  const cruce = cruceEventos({ dias }, pedidos);
  const faltas = faltasPedido({ ...f, dias }, hoy, cruce ? { evento: cruce.pedido.evento } : null, horasMin, !!interno).flat();
  if (faltas.length) return { ok: false, error: 'Falta: ' + faltas.join(', ') };
  const primero = dias[0];
  const reparto: RepartoActividad[] = dias.length > 1 ? unirRepartos(dias) : limpiarReparto(f.reparto);
  const actividades = reparto.map((x) => x.actividad);
  if (!actividades.length) return { ok: false, error: 'Elige al menos una actividad.' };
  if (f.evidenciaPath ? !(await evidenciaExiste(f.evidenciaPath)) : !interno) return { ok: false, error: 'La evidencia no terminó de subirse. Adjúntala de nuevo.' };

  const sql = db();
  const { periodo } = ajustes;
  for (let intento = 0; intento < 3; intento++) {
    try {
      const [fila] = await sql`
        insert into requests (periodo, numero, codigo, nombre, cargo, institucion, correo_solicitante, tipo, convenio,
          evento, fecha, inicio, fin, dias, lugar, lejos, responsable, responsable_telefono, cantidad, mismos_estudiantes, actividades, reparto, vestimenta, vestimenta_detalle, evidencia_path, evidencia_nombre)
        select ${periodo}, n, ${'SOL-' + periodo.slice(0, 4) + '-'} || lpad(n::text, 3, '0'),
          ${f.nombre.trim()}, ${f.cargo.trim()}, ${f.institucion.trim()}, ${normalizarCorreo(f.correoSolicitante)},
          ${f.tipo}, ${f.tipo === 'externo' ? f.convenio : 'si'}, ${f.evento.trim()}, ${primero.fecha}, ${primero.inicio}, ${primero.fin}, ${sql.json(dias as unknown as JSONValue)},
          ${lugar}, ${lejos}, ${f.responsable.trim()}, ${f.responsableTelefono.trim()}, ${Math.round(f.cantidad)}, ${!!f.mismosEstudiantes}, ${actividades}, ${sql.json(reparto as unknown as JSONValue)}, ${f.vestimenta}, ${f.vestimenta === 'otra' ? (f.vestimentaDetalle || '').trim().slice(0, 200) : ''},
          ${f.evidenciaPath}, ${f.evidenciaNombre.slice(0, 200)}
        from (select coalesce(max(numero), 0) + 1 as n from requests where periodo = ${periodo}) s
        returning *`;
      const p = mapPedido(fila);
      await notificarNuevoPedido(p, ajustes);
      return { ok: true, datos: { id: p.id, codigo: p.codigo, evento: p.evento, fechaLarga: fechaLargaDias(p.dias), horario: p.dias.length > 1 ? `${p.dias.length} días` : `${p.inicio}–${p.fin}`, actaUrl: `${appUrl()}/api/acta/${p.id}?t=${tokenActa(p.id)}` } };
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
