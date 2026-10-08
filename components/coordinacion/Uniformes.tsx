'use client';
import { useState } from 'react';
import { alternarPrenda, fijarDevolucion } from '@/app/actions/coordinacion';
import { CorreoBox } from '@/components/CorreoBox';
import { Marco } from '@/components/Marco';
import { useAccion } from '@/components/useAccion';
import { correoDevolucionPendiente } from '@/lib/correos';
import type { Datos } from '@/lib/tipos';
import { fechaCorta, horarioCitaTexto, horarioUniformeTexto } from '@/lib/reglas';
import { type EventoUniformeVista, type PedidoVista, prendasFueraDeBodega, vistaEventosUniforme, vistaUniformes } from '@/lib/vista';
import { CitaUniforme } from './CitaUniforme';

/** '8 oct 10:30' o '8 a 10 oct de 10:30 a 11:30' (resumen corto de una entrega o devolución). */
function citaCorta(fecha: string, hasta: string, hora: string, horaFin: string): string {
  const dias = hasta && hasta !== fecha ? `${fecha.slice(0, 7) === hasta.slice(0, 7) ? fechaCorta(fecha).split(' ')[0] : fechaCorta(fecha)} a ${fechaCorta(hasta)}` : fechaCorta(fecha);
  return `${dias} ${horarioCitaTexto(hora, horaFin)}`;
}

type Vista = 'por-devolver' | 'en-curso' | 'cerrados' | 'estudiantes';

const VISTAS: { clave: Vista; label: string; intro: string; vacio: string }[] = [
  { clave: 'por-devolver', label: 'Por devolver', intro: 'Eventos terminados donde alguien todavía tiene prendas de bodega. Registra aquí Recibido lavado o Sin lavar.', vacio: 'Nadie debe prendas: todos los eventos terminados están al día.' },
  { clave: 'en-curso', label: 'En curso', intro: 'Eventos por venir o en curso. Marca las prendas de bodega que se lleva cada confirmado: es solo control de inventario, nadie está obligado a llevarse todo (puede usar prendas propias).', vacio: 'No hay eventos por venir con uniforme institucional y estudiantes confirmados.' },
  { clave: 'cerrados', label: 'Cerrados', intro: 'Eventos terminados sin prendas pendientes de devolver.', vacio: 'Aún no hay eventos cerrados.' },
  { clave: 'estudiantes', label: 'Por estudiante', intro: '', vacio: '' },
];

export function Uniformes({ datos, pedidos }: { datos: Datos; pedidos: PedidoVista[] }) {
  const { pending, error, run } = useAccion();
  const [todos, setTodos] = useState(false);
  const lista = vistaUniformes(datos, pedidos);
  const eventos = vistaEventosUniforme(datos, pedidos);
  const fuera = prendasFueraDeBodega(datos);
  const grupos: Record<Exclude<Vista, 'estudiantes'>, EventoUniformeVista[]> = {
    'por-devolver': eventos.filter((x) => x.clave === 'por-devolver'),
    'en-curso': eventos.filter((x) => x.clave === 'en-curso'),
    cerrados: eventos.filter((x) => x.clave === 'cerrado'),
  };
  const [vista, setVista] = useState<Vista>(grupos['por-devolver'].length ? 'por-devolver' : grupos['en-curso'].length ? 'en-curso' : grupos.cerrados.length ? 'cerrados' : 'estudiantes');
  const visibles = todos ? lista : lista.filter((u) => u.requiere);
  const nRequieren = lista.filter((u) => u.requiere).length;
  const actual = VISTAS.find((v) => v.clave === vista)!;
  const botonesDevolucion = (p: PedidoVista, studentId: string, clave: string) => clave === 'nada' ? null : (
    <span style={{ display: 'flex', gap: 4, flex: 'none' }}>
      {clave !== 'devuelto' && <button className="btn btn-secondary btn-sm" type="button" onClick={() => run(() => fijarDevolucion(p.id, studentId, 'lavado'))}>Recibido lavado</button>}
      {(clave === 'pendiente' || clave === 'vencido') && <button className="btn btn-ghost btn-sm" type="button" title="Llegó sin lavar: no se recibe" onClick={() => run(() => fijarDevolucion(p.id, studentId, 'rechazado'))}>Sin lavar</button>}
      {(clave === 'devuelto' || clave === 'rechazado') && <button className="btn btn-ghost btn-sm" type="button" onClick={() => run(() => fijarDevolucion(p.id, studentId, null))}>Deshacer</button>}
    </span>
  );

  return (
    <div className={pending ? 'pendiente' : ''}>
      <div className="between abajo mt-6" style={{ gap: 'var(--space-3)' }}>
        <h3 className="m-0">Uniformes</h3>
        <div className="seg" role="radiogroup" aria-label="Vista de uniformes">
          {VISTAS.map((v) => {
            const n = v.clave === 'estudiantes' ? nRequieren : grupos[v.clave].length;
            return <label key={v.clave} className="seg-opt"><input type="radio" name="uni-vista" checked={vista === v.clave} onChange={() => setVista(v.clave)} />{v.label}{n ? ` (${n})` : ''}</label>;
          })}
        </div>
      </div>
      <Marco className="p-3 mt-3 between" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div className="fs-13" style={{ minWidth: 0 }}>
          <h6 className="m-0" style={{ display: 'inline' }}>Horario fijo del periodo {datos.ajustes.periodo}: </h6>
          {datos.ajustes.uniformeHorario.length
            ? <span><strong>{horarioUniformeTexto(datos.ajustes.uniformeHorario)}</strong>{datos.ajustes.uniformeLugar ? ` · ${datos.ajustes.uniformeLugar}` : ''} · se retira antes del evento y se devuelve lavado dentro de los {datos.ajustes.uniformeDiasDevolucion} días siguientes.</span>
            : <span className="falta">sin horario fijo. Fíjalo en Resumen → Ajustes o cada evento necesitará su propia entrega y devolución.</span>}
          <div className="muted fs-12 mt-2"><strong>Fuera de bodega:</strong> {fuera.length ? fuera.map((x) => `${x.item} ${x.n}`).join(' · ') : 'ninguna prenda; todo en bodega'}. Se marcan solo las prendas que cada uno se lleva (puede usar prendas propias); al marcar «Recibido lavado» vuelven a bodega.</div>
        </div>
        <a className="btn btn-ghost btn-sm" href="/coordinacion?tab=resumen">Cambiar en Ajustes</a>
      </Marco>
      {error && <p className="error mt-3">{error}</p>}

      {vista !== 'estudiantes' && (
        <>
          <p className="muted fs-14 mt-4" style={{ marginBottom: 0 }}>{actual.intro}</p>
          {!eventos.length && <p className="muted mt-3">Aún no hay eventos aprobados con uniforme institucional y estudiantes confirmados.</p>}
          {eventos.length > 0 && !grupos[vista].length && <p className="muted mt-3">{actual.vacio}</p>}
          <div className="cols-auto-340 mt-3">
            {grupos[vista].map((x) => {
              const p = x.p;
              const cita = p.uniformeCita;
              const resumenCita = cita?.entregaFecha || cita?.devolucionFecha
                ? [cita.entregaFecha ? `entrega ${citaCorta(cita.entregaFecha, cita.entregaHasta, cita.entregaHora, cita.entregaHoraFin)}` : '', cita.devolucionFecha ? `devolución ${citaCorta(cita.devolucionFecha, cita.devolucionHasta, cita.devolucionHora, cita.devolucionHoraFin)}` : ''].filter(Boolean).join(' · ')
                : '';
              return (
                <Marco key={p.id} className={`card p-4 ${p.tipoClass} ${p.finalizado ? 'finalizado' : ''}`}>
                  <div className="between arriba" style={{ gap: 6 }}><div className="card-kicker">{p.codigo} · {p.tipoLabel} · {p.fechaCorta}</div><span className={`tag ${x.tag}`}>{x.label}</span></div>
                  <div className="card-title" style={{ fontSize: 17 }}>{p.evento}</div>
                  <div className="card-meta">{p.confirmadosN} confirmado(s) · {x.fase === 'entrega' ? `${x.conPrendasN} con prendas de bodega` : `terminó el ${fechaCorta(p.ultimaFecha)}`}</div>
                  <div className="borde-arriba stack-2" style={{ paddingTop: 'var(--space-2)' }}>
                    {x.fase === 'entrega' ? (
                      <>
                        <div className="between"><span className="heading fs-12" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>Prendas que se lleva cada uno</span><span className={`tag ${x.conPrendasN ? 'tag-accent' : 'tag-neutral'}`}>{x.conPrendasN}/{x.filas.length} con prendas</span></div>
                        {x.filas.map((f) => (
                          <div key={f.e.id} className="linea-item arriba" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                            <div className="between"><span>{f.e.nombre} <span className="muted fs-12">· {f.e.genero === 'F' ? 'femenino' : 'masculino'}</span></span><span className={`tag ${f.info.tagClass}`} style={{ fontSize: 10 }}>{f.info.estado}</span></div>
                            <div className="row" style={{ gap: 6 }}>
                              {f.info.items.map((item) => {
                                const on = f.info.tiene.includes(item);
                                return <label key={item} className={`radio chip ${on ? 'on' : ''}`}><input type="checkbox" checked={on} onChange={() => run(() => alternarPrenda(f.e.id, item))} /><span className="dot cuadro" />{item}</label>;
                              })}
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        <div className="between"><span className="heading fs-12" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>Devolución · hasta el {fechaCorta(p.devolucionLimite)}</span><span className={`tag ${x.porDevolver.length ? 'tag-outline' : 'tag-verde'}`}>{x.filas.length - x.porDevolver.length}/{x.filas.length} devueltos</span></div>
                        {x.filas.map((f) => (
                          <div key={f.e.id} className="linea-item">
                            <span style={{ minWidth: 0 }}>{f.e.nombre} <span className={`tag ${f.estado.tag}`} style={{ fontSize: 10 }}>{f.estado.label}</span>{f.estado.clave === 'devuelto' ? <span className="muted fs-12"> · {f.devueltas.length ? `${f.devueltas.length} prenda(s) de vuelta en bodega` : 'sin prendas registradas'}</span> : f.estado.clave === 'nada' ? <span className="muted fs-12"> · nada que devolver (si se llevó algo, márcalo en Por estudiante)</span> : f.info.n ? <span className="muted fs-12"> · tiene {f.info.tiene.join(', ')}</span> : null}</span>
                            {botonesDevolucion(p, f.e.id, f.estado.clave)}
                          </div>
                        ))}
                        {x.porDevolver.length > 0 && <CorreoBox titulo="Correo a quienes no han devuelto" correo={correoDevolucionPendiente(p, x.porDevolver)} />}
                      </>
                    )}
                  </div>
                  <details className="borde-arriba" style={{ paddingTop: 'var(--space-2)' }} open={!!resumenCita}>
                    <summary className="fs-13" style={{ cursor: 'pointer' }}>Entrega o devolución distinta del horario fijo{resumenCita ? <span className="muted">: {resumenCita}</span> : <span className="muted"> (solo si este evento lo necesita)</span>}</summary>
                    <div className="mt-2"><CitaUniforme p={p} datos={datos} idPrefijo={`cita-${p.id}`} /></div>
                  </details>
                </Marco>
              );
            })}
          </div>
        </>
      )}

      {vista === 'estudiantes' && (
        <>
          <div className="between mt-4">
            <p className="muted fs-14 m-0">{todos ? `Todos los estudiantes activos (${lista.length}).` : `Estudiantes confirmados en eventos con uniforme institucional o con prendas entregadas (${nRequieren}).`}</p>
            <div className="seg" role="radiogroup" aria-label="Filtro">
              <label className="seg-opt"><input type="radio" name="uni" checked={!todos} onChange={() => setTodos(false)} />Requieren uniforme</label>
              <label className="seg-opt"><input type="radio" name="uni" checked={todos} onChange={() => setTodos(true)} />Todos</label>
            </div>
          </div>
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
                  <div className="row" style={{ gap: 4 }}>{u.eventosUniforme.map((p) => <span key={p.id} className="tag tag-neutral" title={p.codigo}>{p.evento} · {p.fechaCorta}{p.uniformeCita?.entregaFecha ? ` · entrega ${citaCorta(p.uniformeCita.entregaFecha, p.uniformeCita.entregaHasta, p.uniformeCita.entregaHora, p.uniformeCita.entregaHoraFin)}` : ''}</span>)}</div>
                )}
                <div className="row" style={{ gap: 6 }}>
                  {u.info.items.map((item) => {
                    const on = u.info.tiene.includes(item);
                    return <label key={item} className={`radio chip ${on ? 'on' : ''}`}><input type="checkbox" checked={on} onChange={() => run(() => alternarPrenda(u.id, item))} /><span className="dot cuadro" />{item}</label>;
                  })}
                </div>
                <div className="muted fs-12">{u.detalle}</div>
                <div className="borde-arriba stack-2" style={{ paddingTop: 'var(--space-2)', gap: 6 }}>
                  <div className="between"><span className="heading fs-12" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>Devolución por evento</span><span className={`tag ${u.devTag}`}>{u.devLabel}</span></div>
                  {u.devoluciones.length === 0 && <div className="muted fs-12">Sin eventos con uniforme.</div>}
                  {u.devoluciones.map(({ p, estado }) => (
                    <div key={p.id} className="between fs-12" style={{ gap: 6 }}>
                      <span style={{ minWidth: 0 }}>{p.evento} · {p.fechaCorta} <span className={`tag ${estado.tag}`} style={{ fontSize: 10 }}>{estado.label}</span></span>
                      {estado.clave !== 'en-curso' && estado.clave !== 'nada' && botonesDevolucion(p, u.id, estado.clave)}
                    </div>
                  ))}
                </div>
              </Marco>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
