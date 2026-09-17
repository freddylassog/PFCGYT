'use client';
import { useState } from 'react';
import { alternarPrenda, fijarDevolucion } from '@/app/actions/coordinacion';
import { Marco } from '@/components/Marco';
import { useAccion } from '@/components/useAccion';
import type { Datos } from '@/lib/tipos';
import { fechaCorta } from '@/lib/reglas';
import { vistaUniformes, type PedidoVista } from '@/lib/vista';
import { CitaUniforme } from './CitaUniforme';

export function Uniformes({ datos, pedidos }: { datos: Datos; pedidos: PedidoVista[] }) {
  const { pending, error, run } = useAccion();
  const [todos, setTodos] = useState(false);
  const lista = vistaUniformes(datos, pedidos);
  const visibles = todos ? lista : lista.filter((u) => u.requiere);
  const nRequieren = lista.filter((u) => u.requiere).length;
  const eventos = pedidos.filter((p) => p.estado === 'Aprobado' && p.vestimenta === 'uniforme' && p.confirmadosN > 0);
  return (
    <div className={pending ? 'pendiente' : ''}>
      <div className="mt-6"><h3 className="m-0">Entrega y devolución por evento</h3><p className="muted fs-14" style={{ margin: 'var(--space-1) 0 0' }}>Fija fecha, hora y lugar para cada evento con uniforme institucional y avisa a los confirmados por Telegram o por correo. El día anterior a cada entrega o devolución la app envía un recordatorio.</p></div>
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
              <div className="row" style={{ gap: 4 }}>{u.eventosUniforme.map((p) => <span key={p.id} className="tag tag-neutral" title={p.codigo}>{p.evento} · {p.fechaCorta}{p.uniformeCita?.entregaFecha ? ` · entrega ${fechaCorta(p.uniformeCita.entregaFecha)} ${p.uniformeCita.entregaHora}` : ''}{p.uniformeCita?.devolucionFecha ? ` · devolución ${fechaCorta(p.uniformeCita.devolucionFecha)} ${p.uniformeCita.devolucionHora}` : ''}</span>)}</div>
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
