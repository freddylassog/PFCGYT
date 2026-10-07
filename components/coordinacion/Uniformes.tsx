'use client';
import { useState } from 'react';
import { alternarPrenda, fijarDevolucion } from '@/app/actions/coordinacion';
import { Marco } from '@/components/Marco';
import { useAccion } from '@/components/useAccion';
import type { Datos } from '@/lib/tipos';
import { fechaCorta, horarioCitaTexto, horarioUniformeTexto } from '@/lib/reglas';
import { vistaUniformes, type PedidoVista } from '@/lib/vista';
import { CitaUniforme } from './CitaUniforme';

/** '8 oct 10:30' o '8 a 10 oct de 10:30 a 11:30' (resumen corto de una entrega o devolución). */
function citaCorta(fecha: string, hasta: string, hora: string, horaFin: string): string {
  const dias = hasta && hasta !== fecha ? `${fecha.slice(0, 7) === hasta.slice(0, 7) ? fechaCorta(fecha).split(' ')[0] : fechaCorta(fecha)} a ${fechaCorta(hasta)}` : fechaCorta(fecha);
  return `${dias} ${horarioCitaTexto(hora, horaFin)}`;
}

export function Uniformes({ datos, pedidos }: { datos: Datos; pedidos: PedidoVista[] }) {
  const { pending, error, run } = useAccion();
  const [todos, setTodos] = useState(false);
  const lista = vistaUniformes(datos, pedidos);
  const visibles = todos ? lista : lista.filter((u) => u.requiere);
  const nRequieren = lista.filter((u) => u.requiere).length;
  const eventos = pedidos.filter((p) => p.estado === 'Aprobado' && p.vestimenta === 'uniforme' && p.confirmadosN > 0);
  return (
    <div className={pending ? 'pendiente' : ''}>
      <div className="mt-6"><h3 className="m-0">Retiro y devolución de uniformes</h3></div>
      <Marco className="p-4 stack-2 mt-3">
        <div className="between"><h6 className="m-0">Horario fijo del periodo {datos.ajustes.periodo}</h6><a className="btn btn-ghost btn-sm" href="/coordinacion?tab=resumen">Cambiar en Ajustes</a></div>
        {datos.ajustes.uniformeHorario.length
          ? <p className="m-0 fs-14"><strong>{horarioUniformeTexto(datos.ajustes.uniformeHorario)}</strong>{datos.ajustes.uniformeLugar ? ` · ${datos.ajustes.uniformeLugar}` : ''}</p>
          : <p className="falta fs-13 m-0">Sin horario fijo: cada evento necesita su propia entrega y devolución. Fíjalo en Resumen → Ajustes.</p>}
        <p className="muted fs-12 m-0">Los estudiantes lo ven en su portal, en la convocatoria y en la confirmación de cada evento con uniforme; retiran antes del evento y devuelven lavado después, en cualquiera de esas franjas. También está en tu calendario suscrito como evento semanal.</p>
      </Marco>
      <div className="mt-6"><h4 className="m-0">Excepciones por evento</h4><p className="muted fs-14" style={{ margin: 'var(--space-1) 0 0' }}>Solo si un evento necesita una entrega o devolución distinta del horario fijo: fija día y hora (o un periodo, p. ej. lunes a miércoles de 10:00 a 11:00) y avisa a los confirmados por Telegram o por correo. El día anterior a esa entrega o devolución la app envía un recordatorio.</p></div>
      {!eventos.length && <p className="muted mt-3">Aún no hay eventos aprobados con uniforme institucional y estudiantes confirmados.</p>}
      <div className="cols-auto-340 mt-3">
        {eventos.map((p) => (
          <Marco key={p.id} className={`card p-4 ${p.tipoClass} ${p.finalizado ? 'finalizado' : ''}`}>
            <div className="card-kicker">{p.codigo} · {p.tipoLabel} · {p.fechaCorta}</div>
            <div className="card-title" style={{ fontSize: 17 }}>{p.evento}</div>
            <div className="card-meta">{p.confirmadosN} confirmados: {p.confirmados.map((e) => e.nombre).join(', ')}</div>
            <CitaUniforme p={p} datos={datos} idPrefijo={`cita-${p.id}`} />
          </Marco>
        ))}
      </div>
      <div className="mt-8"><h3 className="m-0">Prendas por estudiante</h3></div>
      <div className="between mt-3">
        <p className="muted fs-14 m-0">{todos ? `Todos los estudiantes activos (${lista.length}).` : `Estudiantes confirmados en eventos con uniforme institucional o con prendas entregadas (${nRequieren}).`}</p>
        <div className="seg" role="radiogroup" aria-label="Filtro">
          <label className="seg-opt"><input type="radio" name="uni" checked={!todos} onChange={() => setTodos(false)} />Requieren uniforme</label>
          <label className="seg-opt"><input type="radio" name="uni" checked={todos} onChange={() => setTodos(true)} />Todos</label>
        </div>
      </div>
      {error && <p className="error mt-4">{error}</p>}
      {lista.length === 0 && <p className="muted mt-4">Carga el listado de estudiantes en la pestaña Estudiantes para registrar uniformes.</p>}
      {lista.length > 0 && visibles.length === 0 && <p className="muted mt-4">Aún no hay estudiantes confirmados en eventos con uniforme institucional. Cuando confirmes a alguien en un evento con esa vestimenta aparecerá aquí.</p>}
      <div className="cols-auto-340 mt-4">
        {visibles.map((u) => (
          <Marco key={u.id} className="p-4 stack-3">
            <div className="between arriba">
              <div><div className="card-title" style={{ fontSize: 17 }}>{u.nombre}</div><div className="card-meta">{u.semLabel}{u.paralelo ? ` · ${u.paralelo}` : ''} · uniforme {u.generoLabel}</div></div>
              <span className={`tag ${u.info.tagClass}`}>{u.info.estado}</span>
            </div>
            {u.eventosUniforme.length > 0 && (
              <div className="row" style={{ gap: 4 }}>{u.eventosUniforme.map((p) => <span key={p.id} className="tag tag-neutral" title={p.codigo}>{p.evento} · {p.fechaCorta}{p.uniformeCita?.entregaFecha ? ` · entrega ${citaCorta(p.uniformeCita.entregaFecha, p.uniformeCita.entregaHasta, p.uniformeCita.entregaHora, p.uniformeCita.entregaHoraFin)}` : ''}{p.uniformeCita?.devolucionFecha ? ` · devolución ${citaCorta(p.uniformeCita.devolucionFecha, p.uniformeCita.devolucionHasta, p.uniformeCita.devolucionHora, p.uniformeCita.devolucionHoraFin)}` : ''}</span>)}</div>
            )}
            <div className="row" style={{ gap: 6 }}>
              {u.info.items.map((item) => {
                const on = u.info.tiene.includes(item);
                return <label key={item} className={`radio chip ${on ? 'on' : ''}`}><input type="checkbox" checked={on} onChange={() => run(() => alternarPrenda(u.id, item))} /><span className="dot cuadro" />{item}</label>;
              })}
            </div>
            <div className="muted fs-12">{u.detalle}</div>
            <div className="borde-arriba stack-2" style={{ paddingTop: 'var(--space-2)', gap: 6 }}>
              <div className="between"><span className="heading fs-12" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>Devolución</span><span className={`tag ${u.devTag}`}>{u.devLabel}</span></div>
              <div className="row">
                <button className="btn btn-secondary btn-sm" type="button" disabled={!u.info.n} onClick={() => run(() => fijarDevolucion(u.id, 'lavado'))}>Recibido lavado</button>
                <button className="btn btn-ghost btn-sm" type="button" disabled={!u.info.n} onClick={() => run(() => fijarDevolucion(u.id, 'rechazado'))}>No recibido · sin lavar</button>
                {u.devolucion && <button className="btn btn-ghost btn-sm" type="button" onClick={() => run(() => fijarDevolucion(u.id, null))}>Deshacer</button>}
              </div>
            </div>
          </Marco>
        ))}
      </div>
    </div>
  );
}
