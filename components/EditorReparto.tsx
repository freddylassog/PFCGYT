'use client';
import { ACTIVIDADES, ajustarRepartoATotal, alternarActividad, sumaReparto } from '@/lib/reglas';
import type { RepartoActividad } from '@/lib/tipos';

/** Lista de actividades con la cantidad de estudiantes asignada a cada una. */
export function EditorReparto({ reparto, cantidad, onChange, idPrefijo = 'act' }: { reparto: RepartoActividad[]; cantidad: number; onChange: (r: RepartoActividad[]) => void; idPrefijo?: string }) {
  const suma = sumaReparto(reparto);
  const setCantidad = (actividad: string, v: number) => onChange(reparto.map((x) => (x.actividad === actividad ? { ...x, cantidad: Math.max(0, Math.min(cantidad, Math.round(v) || 0)) } : x)));
  return (
    <div className="stack-2">
      {ACTIVIDADES.map((a, i) => {
        const item = reparto.find((x) => x.actividad === a);
        return (
          <div key={a} className="between" style={{ gap: 'var(--space-2)', borderBottom: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)', padding: '4px 0' }}>
            <label className="radio fs-14" style={{ flex: 1 }}><input type="checkbox" id={`${idPrefijo}-${i}`} checked={!!item} onChange={() => onChange(alternarActividad(reparto, a, cantidad))} /><span className="dot cuadro" />{a}</label>
            {item && (
              <span className="row" style={{ gap: 6, flex: 'none' }}>
                <input className="input" type="number" min={1} max={cantidad} value={item.cantidad} aria-label={`Estudiantes en ${a}`} onChange={(e) => setCantidad(a, Number(e.target.value))} style={{ width: 70, textAlign: 'center' }} />
                <span className="muted fs-12">estudiantes</span>
              </span>
            )}
          </div>
        );
      })}
      <p className={`fs-12 m-0 ${suma === cantidad && reparto.length ? 'muted' : ''}`} style={suma !== cantidad && reparto.length ? { color: 'var(--color-accent-800)' } : undefined}>
        Asignados: <strong>{suma}</strong> de {cantidad} estudiantes{reparto.length && suma !== cantidad ? (suma < cantidad ? ` · faltan ${cantidad - suma} por asignar` : ` · sobran ${suma - cantidad}`) : ''}.
      </p>
    </div>
  );
}

export { ajustarRepartoATotal };
