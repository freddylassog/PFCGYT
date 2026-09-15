'use client';
import { MAX_DIAS_EVENTO, fmtDur, sumarDias } from '@/lib/reglas';
import type { DiaEvento } from '@/lib/tipos';

/** Lista editable de días del evento, cada uno con su horario. */
export function EditorDias({ dias, onChange, min, idPrefijo = 'dia' }: { dias: DiaEvento[]; onChange: (d: DiaEvento[]) => void; min?: string; idPrefijo?: string }) {
  const set = (i: number, k: keyof DiaEvento, v: string) => onChange(dias.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const agregar = () => {
    const ultimo = dias[dias.length - 1];
    onChange([...dias, { fecha: ultimo?.fecha ? sumarDias(ultimo.fecha, 1) : '', inicio: ultimo?.inicio ?? '09:00', fin: ultimo?.fin ?? '13:00' }]);
  };
  return (
    <div className="stack-2">
      {dias.map((d, i) => (
        <div key={i} className="row" style={{ gap: 'var(--space-2)', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 150px', margin: 0 }}><label htmlFor={`${idPrefijo}-fecha-${i}`}>{dias.length > 1 ? `Día ${i + 1}` : 'Fecha del evento'}</label><input id={`${idPrefijo}-fecha-${i}`} className="input" type="date" value={d.fecha} min={min} onChange={(e) => set(i, 'fecha', e.target.value)} /></div>
          <div className="field" style={{ flex: '0 1 110px', margin: 0 }}><label htmlFor={`${idPrefijo}-inicio-${i}`}>Inicio</label><input id={`${idPrefijo}-inicio-${i}`} className="input" type="time" value={d.inicio} onChange={(e) => set(i, 'inicio', e.target.value)} /></div>
          <div className="field" style={{ flex: '0 1 110px', margin: 0 }}><label htmlFor={`${idPrefijo}-fin-${i}`}>Salida</label><input id={`${idPrefijo}-fin-${i}`} className="input" type="time" value={d.fin} onChange={(e) => set(i, 'fin', e.target.value)} /></div>
          <span className="muted fs-12 nowrap" style={{ minHeight: 36, display: 'flex', alignItems: 'center' }}>{fmtDur(d.inicio, d.fin)}</span>
          {dias.length > 1 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(dias.filter((_, j) => j !== i))} aria-label={`Quitar día ${i + 1}`}>Quitar</button>}
        </div>
      ))}
      {dias.length < MAX_DIAS_EVENTO && <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={agregar}>+ Agregar otro día</button>}
      {dias.length > 1 && <p className="muted fs-12 m-0">Un evento de varios días cuenta como un solo evento para cada estudiante; las horas de todos los días se suman.</p>}
    </div>
  );
}
