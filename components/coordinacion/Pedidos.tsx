'use client';
import { useMemo, useState } from 'react';
import { usePreferencia } from '@/components/usePreferencia';
import type { Datos } from '@/lib/tipos';
import { ESTADOS, MESES_LARGO, cruceEventos, fechaISO, sumarDias, toDate } from '@/lib/reglas';
import type { PedidoVista } from '@/lib/vista';
import { Marco } from '@/components/Marco';
import { PanelPedido } from './PanelPedido';

type Vista = 'tabla' | 'tablero' | 'calendario';
const VISTAS: [Vista, string][] = [['tabla', 'Tabla'], ['tablero', 'Tablero'], ['calendario', 'Calendario']];
const VISTAS_VALIDAS: Vista[] = ['tabla', 'tablero', 'calendario'];
const DIAS_CAB = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function Pedidos({ datos, pedidos, selInicial }: { datos: Datos; pedidos: PedidoVista[]; selInicial: string | null }) {
  const [vista, elegirVista] = usePreferencia<Vista>('pf_vista', 'tabla', VISTAS_VALIDAS);
  const [selId, setSelId] = useState<string | null>(selInicial);
  const [mes, setMes] = useState(datos.hoy.slice(0, 7));

  const crucesEv = useMemo(() => new Map(pedidos.map((p) => [p.id, cruceEventos(p, pedidos, p.id)])), [pedidos]);
  const sel = pedidos.find((p) => p.id === selId) ?? null;

  const calendario = useMemo(() => {
    const [y, m] = mes.split('-').map(Number);
    const primero = fechaISO(new Date(y, m - 1, 1));
    const ultimo = fechaISO(new Date(y, m, 0));
    const dowPrimero = (toDate(primero).getDay() + 6) % 7; // 0 = lunes
    const inicio = sumarDias(primero, -dowPrimero);
    const dias: { iso: string; num: number; enMes: boolean; items: PedidoVista[] }[] = [];
    for (let iso = inicio; dias.length < 42 && (iso <= ultimo || dias.length % 7 !== 0); iso = sumarDias(iso, 1)) {
      dias.push({ iso, num: toDate(iso).getDate(), enMes: iso.slice(0, 7) === mes, items: pedidos.filter((p) => p.fecha === iso && p.estado !== 'Rechazado') });
    }
    return { dias, titulo: `${MESES_LARGO[m - 1]} ${y}` };
  }, [mes, pedidos]);

  function moverMes(d: number) {
    const [y, m] = mes.split('-').map(Number);
    const n = new Date(y, m - 1 + d, 1);
    setMes(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`);
  }

  const cruceTexto = (p: PedidoVista) => {
    const partes = [];
    if (p.cruces.length) partes.push(`${p.cruces.length} clase(s)`);
    if (crucesEv.get(p.id)) partes.push('1 evento');
    return partes.join(' · ') || '—';
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
        <div className="seg" role="radiogroup" aria-label="Vista">
          {VISTAS.map(([k, label]) => <label key={k} className="seg-opt"><input type="radio" name="vista" checked={vista === k} onChange={() => elegirVista(k)} />{label}</label>)}
        </div>
      </div>
      <div className={`panel-grid ${sel ? 'con-panel' : ''}`}>
        <div style={{ minWidth: 0 }}>
          {vista === 'tabla' && (
            <Marco className="scroll-x">
              <table className="table" style={{ minWidth: 720 }}>
                <thead><tr><th>Código</th><th>Evento</th><th>Tipo</th><th>Fecha</th><th>Horario</th><th>Horas</th><th>Confirmados</th><th>Cruces</th><th>Estado</th></tr></thead>
                <tbody>
                  {pedidos.length === 0 && <tr><td colSpan={9} className="muted">Aún no hay pedidos en este periodo.</td></tr>}
                  {pedidos.map((e) => (
                    <tr key={e.id} className={`clic ${selId === e.id ? 'seleccionada' : ''}`} onClick={() => setSelId(e.id)}>
                      <td className="heading nowrap">{e.codigo}</td>
                      <td>{e.evento}<div className="muted fs-12">{e.institucion}</div></td>
                      <td>{e.tipoLabel}</td>
                      <td className="nowrap">{e.fechaCorta}</td>
                      <td className="nowrap">{e.inicio}–{e.fin}</td>
                      <td className="nowrap">{e.horas} h</td>
                      <td className="nowrap">{e.confirmadosN}/{e.cantidad}{e.inscritosN > 0 && <> <span className="muted fs-12">+{e.inscritosN} por revisar</span></>}</td>
                      <td>{cruceTexto(e)}</td>
                      <td><span className={`tag ${e.tagClass}`}>{e.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Marco>
          )}
          {vista === 'tablero' && (
            <div className="tablero">
              {ESTADOS.map((est) => {
                const items = pedidos.filter((p) => p.estado === est);
                return (
                  <div key={est} className="columna">
                    <div className="columna-cab"><h6 className="m-0">{est}</h6><span className="muted fs-12">{items.length}</span></div>
                    {items.map((e) => (
                      <Marco key={e.id} className={`card clic p-3 ${selId === e.id ? 'seleccionada' : ''}`} role="button" tabIndex={0} onClick={() => setSelId(e.id)} onKeyDown={(ev: React.KeyboardEvent) => { if (ev.key === 'Enter') setSelId(e.id); }}>
                        <div className="card-kicker">{e.codigo} · {e.tipoLabel}</div>
                        <div className="card-title" style={{ fontSize: 16 }}>{e.evento}</div>
                        <div className="card-meta">{e.fechaCorta} · {e.inicio}–{e.fin} · {e.horas} h</div>
                        <div className="card-meta">{e.confirmadosN}/{e.cantidad} confirmados</div>
                      </Marco>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          {vista === 'calendario' && (
            <>
              <div className="between" style={{ marginBottom: 'var(--space-2)' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => moverMes(-1)}>‹ Mes anterior</button>
                <h4 className="m-0" style={{ textTransform: 'capitalize' }}>{calendario.titulo}</h4>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => moverMes(1)}>Mes siguiente ›</button>
              </div>
              <Marco className="calendario">
                {DIAS_CAB.map((d) => <div key={d} className="dia-cab">{d}</div>)}
                {calendario.dias.map((d) => (
                  <div key={d.iso} className={`dia ${d.iso === datos.hoy ? 'hoy' : ''} ${d.enMes ? '' : 'otro-mes'}`}>
                    <div className="muted fs-12" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{d.num}</span><span>{d.iso === datos.hoy ? 'hoy' : ''}</span></div>
                    {d.items.map((e) => (
                      <button key={e.id} type="button" className={`tag ${e.tagClass} evento`} title={`${e.codigo} · ${e.evento}`} onClick={() => setSelId(e.id)}><strong>{e.inicio}</strong> {e.evento}</button>
                    ))}
                  </div>
                ))}
              </Marco>
              <p className="muted fs-12 mt-2">Los pedidos rechazados no aparecen en el calendario. El día de hoy se resalta.</p>
            </>
          )}
        </div>
        {sel && <PanelPedido key={sel.id} p={sel} datos={datos} pedidos={pedidos} cruceEvento={crucesEv.get(sel.id) ?? null} onCerrar={() => setSelId(null)} />}
      </div>
    </>
  );
}
