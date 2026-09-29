'use client';
import { InputNumero } from '@/components/InputNumero';
import { cantidadDia, fechaCorta } from '@/lib/reglas';
import type { DiaEvento } from '@/lib/tipos';

/** Cuántos estudiantes hacen falta cada día de un evento de varios días (por defecto, todos). */
export function CantidadesPorDia({ dias, cantidad, onChange, idPrefijo = 'cant' }: { dias: DiaEvento[]; cantidad: number; onChange: (d: DiaEvento[]) => void; idPrefijo?: string }) {
  if (dias.length <= 1) return null;
  const suma = dias.reduce((a, d) => a + cantidadDia({ cantidad }, d), 0);
  return (
    <div className="field">
      <label>Estudiantes por día</label>
      <div className="row" style={{ gap: 'var(--space-3)' }}>
        {dias.map((d, i) => (
          <div key={i} className="row" style={{ gap: 6 }}>
            <label htmlFor={`${idPrefijo}-dia-${i}`} className="fs-13">Día {i + 1}{d.fecha ? ` · ${fechaCorta(d.fecha)}` : ''}</label>
            <InputNumero id={`${idPrefijo}-dia-${i}`} min={1} max={Math.max(1, cantidad)} value={cantidadDia({ cantidad }, d)} onChange={(n) => onChange(dias.map((x, j) => (j === i ? { ...x, cantidad: n } : x)))} style={{ width: 70, textAlign: 'center' }} />
          </div>
        ))}
      </div>
      <p className={`fs-12 m-0 mt-2 ${suma < cantidad ? 'falta' : 'muted'}`}>Si los mismos estudiantes van todos los días, deja {cantidad} en cada uno. Si cada día necesita distinta cantidad (p. ej. 14 y 6), cámbiala: entre todos los días deben cubrir a los {cantidad} estudiantes{suma < cantidad ? ` (ahora suman ${suma})` : ''}.</p>
    </div>
  );
}
