'use client';
import { useState } from 'react';
import { quitarNovedad, registrarNovedad, reportarNovedades } from '@/app/actions/coordinacion';
import { CorreoBox } from '@/components/CorreoBox';
import { Marco } from '@/components/Marco';
import { useAccion } from '@/components/useAccion';
import { correoDecanato } from '@/lib/correos';
import { TIPOS_NOVEDAD, fechaCorta, semCorto } from '@/lib/reglas';
import type { Datos } from '@/lib/tipos';
import type { PedidoVista } from '@/lib/vista';

export function Novedades({ datos, pedidos }: { datos: Datos; pedidos: PedidoVista[] }) {
  const { pending, error, run } = useAccion();
  const [nv, setNv] = useState({ evId: '', stId: '', tipo: TIPOS_NOVEDAD[0], nota: '' });
  const [seleccion, setSeleccion] = useState<string[] | null>(null);
  const eventosConEst = pedidos.filter((e) => e.estado === 'Aprobado' && e.confirmadosN > 0);
  const nvEv = pedidos.find((e) => e.id === nv.evId) ?? null;
  const grupos = pedidos.filter((e) => e.novedades.length).map((e) => ({ pedido: e, novedades: e.novedades }));
  const pendientes = grupos.flatMap((g) => g.novedades.filter((n) => n.pendiente));
  const seleccionadas = seleccion ? grupos.map((g) => ({ pedido: g.pedido, novedades: g.novedades.filter((n) => seleccion.includes(n.id)) })).filter((g) => g.novedades.length) : [];

  return (
    <div className={`mt-6 ${pending ? 'pendiente' : ''}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
      <Marco className="p-4 stack-3">
        <h6 className="h6-accent">Registrar novedad</h6>
        <div className="field"><label>Evento</label><select className="input" value={nv.evId} onChange={(e) => setNv({ ...nv, evId: e.target.value, stId: '' })}><option value="">Elige un evento…</option>{eventosConEst.map((e) => <option key={e.id} value={e.id}>{e.fechaCorta} · {e.evento}</option>)}</select></div>
        <div className="field"><label>Estudiante</label><select className="input" value={nv.stId} disabled={!nvEv} onChange={(e) => setNv({ ...nv, stId: e.target.value })}><option value="">Elige un estudiante…</option>{nvEv?.confirmados.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>
        <div className="field"><label>Tipo de novedad</label><select className="input" value={nv.tipo} onChange={(e) => setNv({ ...nv, tipo: e.target.value })}>{TIPOS_NOVEDAD.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div className="field"><label>Detalle (opcional)</label><input className="input" value={nv.nota} onChange={(e) => setNv({ ...nv, nota: e.target.value })} placeholder="ej. Sin chaleco ni corbatín" /></div>
        <button className="btn btn-primary btn-40" type="button" disabled={!nvEv || !nv.stId} onClick={() => run(() => registrarNovedad(nv.evId, nv.stId, nv.tipo, nv.nota), () => setNv({ ...nv, stId: '', nota: '' }))}>Registrar novedad</button>
        {error && <p className="error">{error}</p>}
        <p className="muted fs-12 m-0">Las novedades se reportan a decanato para sanción y quedan en el reporte de cada evento y de cada estudiante.</p>
      </Marco>
      <div className="stack">
        <div className="between"><h3 className="m-0">Novedades por evento</h3><button className="btn btn-secondary" type="button" disabled={!pendientes.length} onClick={() => setSeleccion(pendientes.map((n) => n.id))}>Reportar pendientes a decanato ({pendientes.length})</button></div>
        {seleccion && seleccionadas.length > 0 && (
          <CorreoBox titulo={`Correo a decanato · ${seleccion.length} novedad(es)`} abierto correo={correoDecanato(datos, seleccionadas)}
            nota={datos.ajustes.correoDecanato ? undefined : 'Configura el correo de decanato en Resumen → Ajustes para que salga como destinatario.'}
            extra={<>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => run(() => reportarNovedades(seleccion), () => setSeleccion(null))}>Marcar como reportadas</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSeleccion(null)}>Cancelar</button>
            </>} />
        )}
        {!grupos.length && <p className="muted m-0">Sin novedades registradas.</p>}
        {grupos.map((g) => (
          <Marco key={g.pedido.id} className="p-4 stack-2">
            <div className="between" style={{ alignItems: 'baseline' }}><div><div className="card-kicker">{g.pedido.codigo} · {g.pedido.fechaCorta}</div><div className="card-title" style={{ fontSize: 17 }}>{g.pedido.evento}</div></div><span className="muted fs-12">{g.novedades.length} novedad(es)</span></div>
            {g.novedades.map((n) => (
              <div key={n.id} className="linea-item arriba">
                <div style={{ minWidth: 0 }}><strong>{n.estudiante?.nombre}</strong> <span className="muted">{n.estudiante ? semCorto(n.estudiante.semestre) : ''}</span> · {n.tipo}{n.nota && <div className="muted">{n.nota}</div>}</div>
                <span style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 'none' }}>
                  {n.reportadoAt ? <span className="tag tag-accent">Decanato · {fechaCorta(n.reportadoAt)}</span> : (
                    <>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => setSeleccion([n.id])}>Reportar</button>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => run(() => quitarNovedad(n.id))}>Quitar</button>
                    </>
                  )}
                </span>
              </div>
            ))}
          </Marco>
        ))}
      </div>
    </div>
  );
}
