'use client';
import { alternarPrenda, fijarDevolucion } from '@/app/actions/coordinacion';
import { Marco } from '@/components/Marco';
import { useAccion } from '@/components/useAccion';
import type { Datos } from '@/lib/tipos';
import { vistaUniformes } from '@/lib/vista';

export function Uniformes({ datos }: { datos: Datos }) {
  const { pending, error, run } = useAccion();
  const lista = vistaUniformes(datos);
  return (
    <div className={pending ? 'pendiente' : ''}>
      {error && <p className="error mt-4">{error}</p>}
      {lista.length === 0 && <p className="muted mt-6">Carga el listado de estudiantes en la pestaña Estudiantes para registrar uniformes.</p>}
      <div className="cols-auto-340 mt-6">
        {lista.map((u) => (
          <Marco key={u.id} className="p-4 stack-3">
            <div className="between arriba">
              <div><div className="card-title" style={{ fontSize: 17 }}>{u.nombre}</div><div className="card-meta">{u.semLabel} · uniforme {u.generoLabel}</div></div>
              <span className={`tag ${u.info.tagClass}`}>{u.info.estado}</span>
            </div>
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
