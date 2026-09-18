'use client';
import { useState } from 'react';
import { guardarCitaUniforme } from '@/app/actions/coordinacion';
import { CorreoBox } from '@/components/CorreoBox';
import { useAccion } from '@/components/useAccion';
import { correoUniformes } from '@/lib/correos';
import { CITA_VACIA, faltasCitaUniforme, fechaCorta } from '@/lib/reglas';
import type { CitaUniforme as Cita, Datos } from '@/lib/tipos';
import type { PedidoVista } from '@/lib/vista';

/** Fecha, hora y lugar de entrega y devolución del uniforme de un evento, con aviso a los confirmados. */
export function CitaUniforme({ p, datos, idPrefijo = 'cita' }: { p: PedidoVista; datos: Datos; idPrefijo?: string }) {
  const { pending, error, run } = useAccion();
  const [c, setC] = useState<Cita>(p.uniformeCita ?? { ...CITA_VACIA, lugar: datos.ajustes.uniformeLugar });
  const [msg, setMsg] = useState<string | null>(null);
  const faltas = faltasCitaUniforme(c);
  const algo = !!(c.entregaFecha || c.entregaHora || c.devolucionFecha || c.devolucionHora);
  const set = (k: keyof Cita, v: string) => { setMsg(null); setC({ ...c, [k]: v }); };
  const telegram = !!(datos.notificaciones.canalEstudiantes || datos.notificaciones.botUsername);
  const id = (k: string) => `${idPrefijo}-${k}`;
  const guardar = (avisar: boolean) => run(() => guardarCitaUniforme(p.id, c, avisar), (d) => {
    if (!avisar) { setMsg('Cita guardada. Ahora puedes avisar por Telegram o enviar el correo.'); return; }
    const partes = [d?.canal ? 'publicado en el canal de estudiantes' : '', d?.personales ? `${d.personales} mensaje(s) personal(es)` : ''].filter(Boolean);
    setMsg(partes.length ? `Aviso enviado: ${partes.join(' y ')}.` : 'No hay canal ni estudiantes con Telegram: envía el correo de abajo.');
  });
  const aviso = p.uniformeCita?.avisoAt;

  return (
    <div className={`stack-2 ${pending ? 'pendiente' : ''}`}>
      <div className="cols-2" style={{ gap: 'var(--space-2)' }}>
        <div className="field"><label htmlFor={id('ef')}>Entrega del uniforme · fecha</label><input id={id('ef')} className="input" type="date" value={c.entregaFecha} onChange={(e) => set('entregaFecha', e.target.value)} /></div>
        <div className="field"><label htmlFor={id('eh')}>Entrega · hora</label><input id={id('eh')} className="input" type="time" value={c.entregaHora} onChange={(e) => set('entregaHora', e.target.value)} /></div>
        <div className="field"><label htmlFor={id('df')}>Devolución (lavado) · fecha</label><input id={id('df')} className="input" type="date" value={c.devolucionFecha} onChange={(e) => set('devolucionFecha', e.target.value)} /></div>
        <div className="field"><label htmlFor={id('dh')}>Devolución · hora</label><input id={id('dh')} className="input" type="time" value={c.devolucionHora} onChange={(e) => set('devolucionHora', e.target.value)} /></div>
        <div className="field" style={{ gridColumn: '1/-1' }}><label htmlFor={id('lugar')}>Lugar de entrega y devolución</label><input id={id('lugar')} className="input" value={c.lugar} onChange={(e) => set('lugar', e.target.value)} placeholder="ej. Oficina de coordinación de protocolo" /></div>
      </div>
      {algo && faltas.length > 0 && <p className="falta fs-12 m-0">Falta: {faltas.join(', ')}.</p>}
      <div className="row">
        <button className="btn btn-secondary btn-sm" type="button" disabled={!!faltas.length} onClick={() => guardar(false)}>Guardar</button>
        <button className="btn btn-primary btn-sm" type="button" disabled={!!faltas.length || !p.confirmadosN || !telegram} title={!p.confirmadosN ? 'Confirma estudiantes primero' : !telegram ? 'Sin Telegram configurado: usa el correo' : ''} onClick={() => guardar(true)}>Guardar y avisar por Telegram</button>
        {aviso ? <span className="tag tag-accent">Avisado · {fechaCorta(aviso.slice(0, 10))}</span> : p.uniformeCita ? <span className="tag tag-outline">Guardada · sin avisar</span> : null}
      </div>
      {msg && <p className="fs-12 m-0" style={{ color: 'var(--color-accent-800)' }}>{msg}</p>}
      {error && <p className="error">{error}</p>}
      {!telegram && <p className="muted fs-12 m-0">Sin Telegram configurado: guarda la cita y envía el correo a los confirmados desde Outlook.</p>}
      {p.uniformeCita && p.confirmadosN > 0 && <CorreoBox titulo="Correo a los confirmados · uniformes" correo={correoUniformes(p)} />}
    </div>
  );
}
